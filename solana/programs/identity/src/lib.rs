// Solana program for identity management
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

// Define the program ID
solana_program::declare_id!("soulbound11111111111111111111111111111111");

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct IdentityAccount {
    pub owner: Pubkey,
    pub ethereum_address: [u8; 20],
    pub did: String,
    pub verification_data: String,
    pub is_verified: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum IdentityInstruction {
    // Initialize a new identity
    Initialize {
        ethereum_address: [u8; 20],
        did: String,
    },
    
    // Set verification status (called by verifier)
    Verify {
        verification_data: String,
    },
    
    // Update DID info
    UpdateDid {
        new_did: String,
    },
    
    // Update Ethereum address
    UpdateEthereumAddress {
        new_ethereum_address: [u8; 20],
    },
}

// Program entrypoint
entrypoint!(process_instruction);

// Process instructions
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = IdentityInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        IdentityInstruction::Initialize { ethereum_address, did } => {
            process_initialize(program_id, accounts, ethereum_address, did)
        },
        IdentityInstruction::Verify { verification_data } => {
            process_verify(program_id, accounts, verification_data)
        },
        IdentityInstruction::UpdateDid { new_did } => {
            process_update_did(program_id, accounts, new_did)
        },
        IdentityInstruction::UpdateEthereumAddress { new_ethereum_address } => {
            process_update_ethereum_address(program_id, accounts, new_ethereum_address)
        },
    }
}

// Initialize a new identity
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    ethereum_address: [u8; 20],
    did: String,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let identity_account = next_account_info(accounts_iter)?;
    let owner = next_account_info(accounts_iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if identity_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let identity = IdentityAccount {
        owner: *owner.key,
        ethereum_address,
        did,
        verification_data: String::new(),
        is_verified: false,
    };

    identity.serialize(&mut *identity_account.data.borrow_mut())?;
    msg!("Identity initialized successfully");
    Ok(())
}

// Verify an identity
fn process_verify(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    verification_data: String,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let identity_account = next_account_info(accounts_iter)?;
    let verifier = next_account_info(accounts_iter)?;

    // In a real implementation, you would check if the verifier is authorized
    // For now, just ensure they're a signer
    if !verifier.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if identity_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let mut identity = IdentityAccount::try_from_slice(&identity_account.data.borrow())?;
    identity.verification_data = verification_data;
    identity.is_verified = true;

    identity.serialize(&mut *identity_account.data.borrow_mut())?;
    msg!("Identity verified successfully");
    Ok(())
}

// Update DID
fn process_update_did(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_did: String,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let identity_account = next_account_info(accounts_iter)?;
    let owner = next_account_info(accounts_iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if identity_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let mut identity = IdentityAccount::try_from_slice(&identity_account.data.borrow())?;
    
    if identity.owner != *owner.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    identity.did = new_did;
    identity.is_verified = false; // Require re-verification after DID change

    identity.serialize(&mut *identity_account.data.borrow_mut())?;
    msg!("DID updated successfully");
    Ok(())
}

// Update Ethereum address
fn process_update_ethereum_address(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_ethereum_address: [u8; 20],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let identity_account = next_account_info(accounts_iter)?;
    let owner = next_account_info(accounts_iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if identity_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let mut identity = IdentityAccount::try_from_slice(&identity_account.data.borrow())?;
    
    if identity.owner != *owner.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    identity.ethereum_address = new_ethereum_address;
    identity.is_verified = false; // Require re-verification after address change

    identity.serialize(&mut *identity_account.data.borrow_mut())?;
    msg!("Ethereum address updated successfully");
    Ok(())
}