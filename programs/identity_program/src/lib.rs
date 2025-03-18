use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("HU18d3qUrvLK52mQ2AoNKEnV6m1B6VreZ8M7eUE5GBew");

// Define the Wormhole program ID as a constant Pubkey
pub mod wormhole_constants {
    use anchor_lang::prelude::*;
   
    // Wormhole program ID for Solana devnet
    pub const WORMHOLE_PROGRAM_ID: Pubkey = solana_program::pubkey!("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5");
}

#[program]
pub mod identity_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.verification_count = 0;
        state.credential_count = 0;
        Ok(())
    }

    pub fn receive_message(ctx: Context<ReceiveMessage>, vaa: Vec<u8>) -> Result<()> {
        // Manual parsing of the VAA - simplified version
       
        // Extract payload from VAA - this is a placeholder
        let payload_bytes = &vaa[..];
        let payload: MessagePayload = deserialize(payload_bytes)?;
        
        let state = &mut ctx.accounts.state;

        match payload.msg_type {
            MessageType::Verification => {
                let (request_id, did) = deserialize_verification(&payload.data)?;
                emit!(VerificationEvent {
                    request_id,
                    did: VecToString::try_into(did)?,
                    verified: true,
                });
                state.verification_count += 1;

                // Store response for later use
                let _response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::VerificationResponse,
                    data: serialize(&VerificationResponse { request_id, verified: true })?,
                    timestamp: Clock::get()?.unix_timestamp as u64,
                    message_id: solana_program::hash::hash(&serialize(&request_id)?).to_bytes(),
                })?;
                // Placeholder for future implementation
            }
            MessageType::AssetCreation => {
                let (issuer, name, symbol) = deserialize_asset_creation(&payload.data)?;
                emit!(AssetCreationEvent {
                    issuer,
                    name: VecToString::try_into(name)?,
                    symbol: VecToString::try_into(symbol)?,
                });
            }
            MessageType::TokenTransfer => {
                let (transfer_id, _token_address, amount) = deserialize_token_transfer(&payload.data)?;
                let mint_ctx = ctx.accounts.into_mint_context();
                anchor_spl::token::mint_to(mint_ctx, amount as u64)?;

                // Store response for later use
                let _response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::TokenTransferResponse,
                    data: serialize(&TokenTransferResponse { transfer_id, success: true })?,
                    timestamp: Clock::get()?.unix_timestamp as u64,
                    message_id: solana_program::hash::hash(&serialize(&transfer_id)?).to_bytes(),
                })?;
                // Placeholder for future implementation
            }
            MessageType::CredentialVerification => {
                let (request_id, credential_hash) = deserialize_credential_verification(&payload.data)?;
                
                // For now, just emit an event - in a real implementation, we would check the credential
                emit!(CredentialVerificationEvent {
                    request_id,
                    credential_hash,
                    verified: true,
                });
                
                state.credential_count += 1;
                
                // Store response for later use
                let _response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::CredentialVerificationResponse,
                    data: serialize(&CredentialVerificationResponse { 
                        request_id, 
                        verified: true 
                    })?,
                    timestamp: Clock::get()?.unix_timestamp as u64,
                    message_id: solana_program::hash::hash(&serialize(&request_id)?).to_bytes(),
                })?;
            }
            MessageType::RoleSynchronization => {
                let (request_id, role, account, is_grant) = deserialize_role_sync(&payload.data)?;
                
                // In a real implementation, we would update our role registry
                // For now, just emit an event
                emit!(RoleSyncEvent {
                    request_id,
                    role,
                    account,
                    is_grant,
                });
                
                // Store response for later use
                let _response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::RoleSyncResponse,
                    data: serialize(&RoleSyncResponse { 
                        request_id, 
                        success: true 
                    })?,
                    timestamp: Clock::get()?.unix_timestamp as u64,
                    message_id: solana_program::hash::hash(&serialize(&request_id)?).to_bytes(),
                })?;
            }
            MessageType::DIDResolution => {
                let (request_id, did) = deserialize_verification(&payload.data)?;
                
                // For now, just emit an event - in a real implementation, we would resolve the DID
                emit!(DIDResolutionEvent {
                    request_id,
                    did: VecToString::try_into(did)?,
                    resolved: true,
                });
                
                // Store response for later use
                let _response_payload = serialize(&MessagePayload {
                    msg_type: MessageType::DIDResolutionResponse,
                    data: serialize(&DIDResolutionResponse { 
                        request_id, 
                        resolved: true,
                        did_document: Vec::new(), // Placeholder
                    })?,
                    timestamp: Clock::get()?.unix_timestamp as u64,
                    message_id: solana_program::hash::hash(&serialize(&request_id)?).to_bytes(),
                })?;
            }
            _ => return Err(ErrorCode::InvalidMessageType.into()),
        }
        Ok(())
    }
    
    // Store a credential hash and mark it as valid
    pub fn store_credential(ctx: Context<StoreCredential>, credential_hash: [u8; 32]) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let credential = &mut ctx.accounts.credential;
        
        credential.hash = credential_hash;
        credential.is_valid = true;
        credential.owner = ctx.accounts.authority.key();
        credential.revocation_date = 0; // Not revoked
        
        state.credential_count += 1;
        
        emit!(CredentialStoredEvent {
            credential_pubkey: credential.key(),
            credential_hash,
            owner: ctx.accounts.authority.key(),
        });
        
        Ok(())
    }
    
    // Revoke a credential
    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        
        // Only the owner can revoke
        require!(
            credential.owner == ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        
        // Mark as revoked with current timestamp
        credential.is_valid = false;
        credential.revocation_date = Clock::get()?.unix_timestamp as u64;
        
        emit!(CredentialRevokedEvent {
            credential_pubkey: credential.key(),
            credential_hash: credential.hash,
            revocation_date: credential.revocation_date,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 8)]
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
    // Use the Pubkey constant
    #[account(address = wormhole_constants::WORMHOLE_PROGRAM_ID)]
    pub wormhole_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StoreCredential<'info> {
    #[account(mut)]
    pub state: Account<'info, ProgramState>,
    #[account(init, payer = authority, space = 8 + 32 + 1 + 32 + 8)]
    pub credential: Account<'info, Credential>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    #[account(mut)]
    pub credential: Account<'info, Credential>,
    pub authority: Signer<'info>,
}

#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub verification_count: u64,
    pub credential_count: u64,
}

#[account]
pub struct Credential {
    pub hash: [u8; 32],
    pub is_valid: bool,
    pub owner: Pubkey,
    pub revocation_date: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum MessageType {
    Verification,
    VerificationResponse,
    AssetCreation,
    TokenTransfer,
    TokenTransferResponse,
    CredentialVerification,
    CredentialVerificationResponse,
    RoleSynchronization,
    RoleSyncResponse,
    DIDResolution,
    DIDResolutionResponse,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessagePayload {
    pub msg_type: MessageType,
    pub data: Vec<u8>,
    pub timestamp: u64,
    pub message_id: [u8; 32],
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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CredentialVerificationResponse {
    pub request_id: u64,
    pub verified: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RoleSyncResponse {
    pub request_id: u64,
    pub success: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DIDResolutionResponse {
    pub request_id: u64,
    pub resolved: bool,
    pub did_document: Vec<u8>,
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

#[event]
pub struct CredentialVerificationEvent {
    pub request_id: u64,
    pub credential_hash: [u8; 32],
    pub verified: bool,
}

#[event]
pub struct RoleSyncEvent {
    pub request_id: u64,
    pub role: [u8; 32],
    pub account: [u8; 32],
    pub is_grant: bool,
}

#[event]
pub struct DIDResolutionEvent {
    pub request_id: u64,
    pub did: String,
    pub resolved: bool,
}

#[event]
pub struct CredentialStoredEvent {
    pub credential_pubkey: Pubkey,
    pub credential_hash: [u8; 32],
    pub owner: Pubkey,
}

#[event]
pub struct CredentialRevokedEvent {
    pub credential_pubkey: Pubkey,
    pub credential_hash: [u8; 32],
    pub revocation_date: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid chain ID")]
    InvalidChain,
    #[msg("Invalid message type")]
    InvalidMessageType,
    #[msg("String too long")]
    StringTooLong,
    #[msg("Unauthorized action")]
    Unauthorized,
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

fn deserialize_credential_verification(data: &[u8]) -> Result<(u64, [u8; 32])> {
    let request_id = u64::try_from_slice(&data[0..8])?;
    let mut credential_hash = [0u8; 32];
    credential_hash.copy_from_slice(&data[8..40]);
    Ok((request_id, credential_hash))
}

fn deserialize_role_sync(data: &[u8]) -> Result<(u64, [u8; 32], [u8; 32], bool)> {
    let request_id = u64::try_from_slice(&data[0..8])?;
    let mut role = [0u8; 32];
    role.copy_from_slice(&data[8..40]);
    let mut account = [0u8; 32];
    account.copy_from_slice(&data[40..72]);
    let is_grant = data[72] != 0;
    Ok((request_id, role, account, is_grant))
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
        String::from_utf8(self).map_err(|_| Error::from(ErrorCode::StringTooLong))
    }
}