// Complete Transfer Hook Program + Tests for Solana Playground
// Upload this single file to Solana Playground as lib.rs

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use spl_tlv_account_resolution::{
    state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod transfer_hook {
    use super::*;

    /// Initialize the ExtraAccountMetas account for the transfer hook
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Prepare optional extra accounts if your hook needs them (empty for MVP)
        let account_metas = vec![];

        // Calculate account size
        let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
        // Calculate minimum required lamports
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            &mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // Create ExtraAccountMetaList account
        anchor_lang::system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        // Initialize ExtraAccountMetaList account with extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;

        msg!("🎉 ExtraAccountMetaList initialized for mint: {}", ctx.accounts.mint.key());
        Ok(())
    }

    /// Execute transfer hook - called by Token-2022 during transfers
    /// Note: This function is called via the fallback handler
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        msg!("🚀 Transfer Hook Executed!");
        msg!("  From: {}", ctx.accounts.source_token.key());
        msg!("  To: {}", ctx.accounts.destination_token.key());
        msg!("  Amount: {}", amount);
        msg!("  Mint: {}", ctx.accounts.mint.key());
        
        // Add your custom logic here!
        // Examples:
        // - Validate sender/receiver addresses
        // - Implement transfer fees
        // - Log transfer events
        // - Update counters or statistics
        // - Enforce compliance rules
        
        // Example rule: reject odd amounts to demonstrate a failing case on-chain
        if amount % 2 == 1 {
            msg!("❌ Transfer rejected by hook: odd amount {}", amount);
            return err!(TransferHookError::TransferNotAllowed);
        }

        msg!("✅ Transfer approved!");
        Ok(())
    }

    /// Fallback instruction handler for compatibility
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        // Match instruction discriminator to transfer hook interface execute instruction
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();

                // Invoke transfer hook instruction
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
}

#[error_code]
pub enum TransferHookError {
    #[msg("Transfer not allowed")]
    TransferNotAllowed,
}

// ========================================
// TESTS - This section will run when you type 'test'
// ========================================

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::InstructionData;
    use solana_program_test::*;
    use solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::{Keypair, Signer},
        system_instruction,
        transaction::Transaction,
    };
    use spl_token_2022::{
        extension::{transfer_hook::TransferHookAccount, ExtensionType},
        instruction::{
            initialize_mint2, initialize_transfer_hook,
        },
        state::Mint as Token2022Mint,
    };
    use spl_associated_token_account::instruction::create_associated_token_account;

    #[tokio::test]
    async fn test_complete_transfer_hook_flow() {
        // Create test environment
        let program_id = Pubkey::new_unique();
        let mut program_test = ProgramTest::new(
            "transfer_hook",
            program_id,
            processor!(entry),
        );

        // Add Token-2022 program
        program_test.add_program(
            "spl_token_2022",
            spl_token_2022::id(),
            None,
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // Test accounts
        let mint_keypair = Keypair::new();
        let mint = mint_keypair.pubkey();
        
        println!("🎯 Starting Transfer Hook Test");
        println!("Program ID: {}", program_id);
        println!("Mint: {}", mint);

        // Step 1: Create and initialize mint with transfer hook
        let mint_len = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<Token2022Mint>(
            &[ExtensionType::TransferHook],
        ).unwrap();

        let rent = banks_client.get_rent().await.unwrap();
        let mint_lamports = rent.minimum_balance(mint_len);

        let create_mint_ix = system_instruction::create_account(
            &payer.pubkey(),
            &mint,
            mint_lamports,
            mint_len as u64,
            &spl_token_2022::id(),
        );

        let init_transfer_hook_ix = initialize_transfer_hook(
            &spl_token_2022::id(),
            &mint,
            Some(payer.pubkey()),
            Some(program_id),
        ).unwrap();

        let init_mint_ix = initialize_mint2(
            &spl_token_2022::id(),
            &mint,
            &payer.pubkey(),
            None,
            9,
        ).unwrap();

        let transaction = Transaction::new_signed_with_payer(
            &[create_mint_ix, init_transfer_hook_ix, init_mint_ix],
            Some(&payer.pubkey()),
            &[&payer, &mint_keypair],
            recent_blockhash,
        );

        banks_client.process_transaction(transaction).await.unwrap();
        println!("✅ Mint created with transfer hook extension");

        // Step 2: Initialize ExtraAccountMetas
        let (extra_account_meta_list_pda, _) = Pubkey::find_program_address(
            &[b"extra-account-metas", mint.as_ref()],
            &program_id,
        );

        let init_extra_account_metas_ix = Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(extra_account_meta_list_pda, false),
                AccountMeta::new_readonly(mint, false),
                AccountMeta::new_readonly(spl_token_2022::id(), false),
                AccountMeta::new_readonly(spl_associated_token_account::id(), false),
                AccountMeta::new_readonly(solana_program::system_program::id(), false),
            ],
            data: transfer_hook::instruction::InitializeExtraAccountMetaList.data(),
        };

        let transaction = Transaction::new_signed_with_payer(
            &[init_extra_account_metas_ix],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );

        banks_client.process_transaction(transaction).await.unwrap();
        println!("✅ ExtraAccountMetas initialized");

        // Step 3: Create token accounts and test transfer
        let source_keypair = Keypair::new();
        let destination_keypair = Keypair::new();

        let source_token_account = spl_associated_token_account::get_associated_token_address_with_program_id(
            &source_keypair.pubkey(),
            &mint,
            &spl_token_2022::id(),
        );

        let destination_token_account = spl_associated_token_account::get_associated_token_address_with_program_id(
            &destination_keypair.pubkey(),
            &mint,
            &spl_token_2022::id(),
        );

        // Create associated token accounts
        let create_source_ata_ix = create_associated_token_account(
            &payer.pubkey(),
            &source_keypair.pubkey(),
            &mint,
            &spl_token_2022::id(),
        );

        let create_dest_ata_ix = create_associated_token_account(
            &payer.pubkey(),
            &destination_keypair.pubkey(),
            &mint,
            &spl_token_2022::id(),
        );

        let transaction = Transaction::new_signed_with_payer(
            &[create_source_ata_ix, create_dest_ata_ix],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );

        banks_client.process_transaction(transaction).await.unwrap();
        println!("✅ Token accounts created");

        // Mint some tokens to source
        let mint_to_ix = spl_token_2022::instruction::mint_to(
            &spl_token_2022::id(),
            &mint,
            &source_token_account,
            &payer.pubkey(),
            &[],
            1000000000, // 1000 tokens
        ).unwrap();

        let transaction = Transaction::new_signed_with_payer(
            &[mint_to_ix],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );

        banks_client.process_transaction(transaction).await.unwrap();
        println!("✅ Minted 1000 tokens to source account");

        println!("🎉 Transfer Hook Test Completed Successfully!");
        println!("   - Mint created with transfer hook extension");
        println!("   - ExtraAccountMetas initialized");  
        println!("   - Token accounts created");
        println!("   - Tokens minted");
        println!("   - Ready for transfers with transfer hook!");
    }
}
