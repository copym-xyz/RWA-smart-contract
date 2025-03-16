use anchor_lang::prelude::*;
use wormhole_anchor_sdk::{Wormhole, VaaAccount};
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("8AP9d5dGUcTp3Y1np1FRzSFFySbuVGQ6FhfWGNHvTJsx");




#[program]
pub mod identity_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.verification_count = 0;
        Ok(())
    }

    pub fn receive_message(ctx: Context<ReceiveMessage>, vaa: Vec<u8>) -> Result<()> {
        let vaa_account = VaaAccount::load(&ctx.accounts.wormhole_program, &vaa)?;
        require!(vaa_account.emitter_chain() == 5, ErrorCode::InvalidChain); // Polygon Amoy = 5

        let payload: MessagePayload = deserialize(&vaa_account.payload())?;
        let state = &mut ctx.accounts.state;

        match payload.msg_type {
            MessageType::Verification => {
                let (request_id, did) = deserialize_verification(&payload.data)?;
                emit!(VerificationEvent {
                    request_id,
                    did: did.try_into()?,
                    verified: true,
                });
                state.verification_count += 1;

                let response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::VerificationResponse,
                    data: serialize(&VerificationResponse { request_id, verified: true })?,
                })?;
                ctx.accounts.wormhole_program.post_message(
                    &ctx.accounts.authority,
                    response_payload,
                    5,
                )?;
            }
            MessageType::AssetCreation => {
                let (issuer, name, symbol) = deserialize_asset_creation(&payload.data)?;
                emit!(AssetCreationEvent {
                    issuer,
                    name: name.try_into()?,
                    symbol: symbol.try_into()?,
                });
            }
            MessageType::TokenTransfer => {
                let (transfer_id, token_address, amount) = deserialize_token_transfer(&payload.data)?;
                let mint_ctx = ctx.accounts.into_mint_context();
                anchor_spl::token::mint_to(mint_ctx, amount as u64)?;

                let response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::TokenTransferResponse,
                    data: serialize(&TokenTransferResponse { transfer_id, success: true })?,
                })?;
                ctx.accounts.wormhole_program.post_message(
                    &ctx.accounts.authority,
                    response_payload,
                    5,
                )?;
            }
            _ => return Err(ErrorCode::InvalidMessageType.into()),
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8)]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReceiveMessage<'info> {
    #[account(mut)]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub wormhole_program: Program<'info, Wormhole>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub verification_count: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum MessageType {
    Verification,
    VerificationResponse,
    AssetCreation,
    TokenTransfer,
    TokenTransferResponse,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessagePayload {
    pub msg_type: MessageType,
    pub data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VerificationResponse {
    pub request_id: u64,
    pub verified: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TokenTransferResponse {
    pub transfer_id: u64,
    pub success: bool,
}

#[event]
pub struct VerificationEvent {
    pub request_id: u64,
    pub did: String,
    pub verified: bool,
}

#[event]
pub struct AssetCreationEvent {
    pub issuer: Pubkey,
    pub name: String,
    pub symbol: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid chain ID")]
    InvalidChain,
    #[msg("Invalid message type")]
    InvalidMessageType,
    #[msg("String too long")]
    StringTooLong,
}

fn deserialize_verification(data: &[u8]) -> Result<(u64, Vec<u8>)> {
    let request_id = u64::try_from_slice(&data[0..8])?;
    let did_len = u32::try_from_slice(&data[8..12])? as usize;
    require!(did_len <= 128, ErrorCode::StringTooLong);
    let did = data[12..12 + did_len].to_vec();
    Ok((request_id, did))
}

fn deserialize_asset_creation(data: &[u8]) -> Result<(Pubkey, Vec<u8>, Vec<u8>)> {
    let issuer = Pubkey::try_from_slice(&data[0..32])?;
    let name_len = u32::try_from_slice(&data[32..36])? as usize;
    require!(name_len <= 32, ErrorCode::StringTooLong);
    let name = data[36..36 + name_len].to_vec();
    let symbol_start = 36 + name_len;
    let symbol_len = u32::try_from_slice(&data[symbol_start..symbol_start + 4])? as usize;
    require!(symbol_len <= 10, ErrorCode::StringTooLong);
    let symbol = data[symbol_start + 4..symbol_start + 4 + symbol_len].to_vec();
    Ok((issuer, name, symbol))
}

fn deserialize_token_transfer(data: &[u8]) -> Result<(u64, Pubkey, u64)> {
    let transfer_id = u64::try_from_slice(&data[0..8])?;
    let token_address = Pubkey::try_from_slice(&data[8..40])?;
    let amount = u64::try_from_slice(&data[40..48])?;
    Ok((transfer_id, token_address, amount))
}

fn serialize<T: AnchorSerialize>(data: &T) -> Result<Vec<u8>> {
    Ok(data.try_to_vec()?)
}

fn deserialize<T: AnchorDeserialize>(data: &[u8]) -> Result<T> {
    Ok(T::try_from_slice(data)?)
}

impl<'info> ReceiveMessage<'info> {
    fn into_mint_context(&self) -> CpiContext<'_, '_, '_, 'info, anchor_spl::token::MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: self.token_mint.to_account_info(),
                to: self.recipient.to_account_info(),
                authority: self.authority.to_account_info(),
            },
        )
    }
}

trait VecToString {
    fn try_into(self) -> Result<String>;
}

impl VecToString for Vec<u8> {
    fn try_into(self) -> Result<String> {
        String::from_utf8(self).map_err(|_| error!(ErrorCode::StringTooLong))
    }
}
