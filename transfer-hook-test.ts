// Test file for Transfer Hook Program - Solana Playground
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TransferHook } from "../target/types/transfer_hook";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  mintTo,
  createAccount,
  getMintLen,
  getAssociatedTokenAddressSync,
  createTransferCheckedWithTransferHookInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

describe("transfer-hook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TransferHook as Program<TransferHook>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // Test accounts
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  let sourceTokenAccount: PublicKey;
  let destinationTokenAccount: PublicKey;
  let extraAccountMetaListPDA: PublicKey;

  it("Create Mint Account with Transfer Hook Extension", async () => {
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint,
        wallet.publicKey,
        program.programId, // transfer hook program id
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint,
        9, // decimals
        wallet.publicKey, // mint authority
        null, // freeze authority
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSignature = await provider.sendAndConfirm(transaction, [mintKeypair]);
    console.log(`✅ Mint created: ${mint.toString()}`);
    console.log(`Transaction Signature: ${txSignature}`);
  });

  it("Create Token Accounts and Mint Tokens", async () => {
    // Create source token account
    sourceTokenAccount = getAssociatedTokenAddressSync(
      mint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create destination token account (for a different wallet)
    const destinationWallet = Keypair.generate();
    destinationTokenAccount = getAssociatedTokenAddressSync(
      mint,
      destinationWallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        destinationWallet.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    const txSignature = await provider.sendAndConfirm(transaction);
    console.log(`✅ Token accounts created`);
    console.log(`Source: ${sourceTokenAccount.toString()}`);
    console.log(`Destination: ${destinationTokenAccount.toString()}`);

    // Mint some tokens to source account
    await mintTo(
      connection,
      wallet.payer,
      mint,
      sourceTokenAccount,
      wallet.publicKey,
      1000000000, // 1 billion tokens (with 9 decimals = 1,000 tokens)
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`✅ Minted 1,000 tokens to source account`);
    console.log(`Transaction Signature: ${txSignature}`);
  });

  it("Create ExtraAccountMetaList Account", async () => {
    [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.toBuffer()],
      program.programId
    );

    console.log(`ExtraAccountMetas PDA: ${extraAccountMetaListPDA.toString()}`);

    const instruction = await program.methods
      .initializeExtraAccountMetaList()
      .accounts({
        payer: wallet.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const txSignature = await provider.sendAndConfirm(transaction);

    console.log(`✅ ExtraAccountMetaList initialized`);
    console.log(`Transaction Signature: ${txSignature}`);
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    // Create transfer instruction with transfer hook
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint,
      destinationTokenAccount,
      wallet.publicKey,
      BigInt(100000000), // 100 tokens (with 9 decimals)
      9, // decimals
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(transferInstruction);
    const txSignature = await provider.sendAndConfirm(transaction);

    console.log(`✅ Transfer completed with transfer hook!`);
    console.log(`Transferred 100 tokens`);
    console.log(`Transfer Signature: ${txSignature}`);

    // Verify balances
    const sourceBalance = await connection.getTokenAccountBalance(sourceTokenAccount);
    const destBalance = await connection.getTokenAccountBalance(destinationTokenAccount);

    console.log(`Source balance: ${sourceBalance.value.uiAmount} tokens`);
    console.log(`Destination balance: ${destBalance.value.uiAmount} tokens`);
  });
});
