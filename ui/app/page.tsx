"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Connection, PublicKey, Transaction, SystemProgram, clusterApiUrl, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferCheckedInstruction, ASSOCIATED_TOKEN_PROGRAM_ID, ExtensionType, getMintLen, createInitializeTransferHookInstruction } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';

// TypeScript declarations for Solana wallet
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isConnected?: boolean;
      connect?: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect?: () => Promise<void>;
      signTransaction?: (tx: any) => Promise<any>;
      signAllTransactions?: (txs: any[]) => Promise<any[]>;
      publicKey?: { toString: () => string };
      // Updated method signatures for newer Phantom versions
      sendTransaction?: (tx: any, connection: any, options?: any) => Promise<string>;
      signAndSendTransaction?: (tx: any) => Promise<{ signature: string }>;
    };
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(9);
  const [tokenSupply, setTokenSupply] = useState('');
  const [creating, setCreating] = useState(false);
  const [mintAddress, setMintAddress] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [initializingHook, setInitializingHook] = useState(false);
  const [hookInitError, setHookInitError] = useState('');
  const [hookInitSuccess, setHookInitSuccess] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
    
  // Pool creation state
    const [tokenAMint, setTokenAMint] = useState('');
    const [tokenBMint, setTokenBMint] = useState('');
    const [tokenAAmount, setTokenAAmount] = useState('');
    const [tokenBAmount, setTokenBAmount] = useState('');
  const [creatingPool, setCreatingPool] = useState(false);
  const [poolError, setPoolError] = useState('');
  const [poolSuccess, setPoolSuccess] = useState('');
  
  // AMM initialization state
  const [initializingAmm, setInitializingAmm] = useState(false);
  const [ammError, setAmmError] = useState('');
  const [ammSuccess, setAmmSuccess] = useState('');

  // Swap state
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('0.0');
  const [priceImpact, setPriceImpact] = useState('0.00%');
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState('');
  const [swapSuccess, setSwapSuccess] = useState('');

  // Wallet tokens state
  const [walletTokens, setWalletTokens] = useState<Array<{
    mint: string;
    symbol: string;
    balance: number;
    decimals: number;
  }>>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Pool checking state
  const [checkingPool, setCheckingPool] = useState(false);
  const [poolExists, setPoolExists] = useState<boolean | null>(null);

  // Portfolio state
  const [portfolioData, setPortfolioData] = useState<{
    totalValue: number;
    tokens: Array<{
      mint: string;
      symbol: string;
      balance: number;
      decimals: number;
      usdValue?: number;
      change24h?: number;
    }>;
    pools: Array<{
      tokenA: string;
      tokenB: string;
      liquidity: number;
      fees24h: number;
    }>;
    transactions: Array<{
      type: 'swap' | 'create_pool' | 'transfer';
      timestamp: number;
      signature: string;
      details: any;
    }>;
  }>({
    totalValue: 0,
    tokens: [],
    pools: [],
    transactions: []
  });
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Replace with your deployed transfer hook program ID on devnet
  const TRANSFER_HOOK_PROGRAM_ID = 'GfXgLTyDbBP3LJL5XZtnBPgQm1NuQ7xNCf4wNLYHSt1U';
  // Replace with your deployed AMM program ID on devnet
  // OLD: 'DCjgs2YXvEiZsiXVSMskg8ReMSsYbuLDpfMkXvP5iwsC' (has unsafe math - caused panics)
  // FIXED: Improved AMM with safe math operations and correct declare_id!
  const AMM_PROGRAM_ID = '2upnrRae7koqW99o5UE314GDwawiZccjue5qe7oUY43b';

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '🏠' },
    { id: 'create-token', name: 'Create Token', icon: '🪙' },
    { id: 'create-pool', name: 'Create Pool', icon: '🏊' },
    { id: 'trade', name: 'Trade', icon: '📈' },
    { id: 'portfolio', name: 'Portfolio', icon: '💼' },
  ];

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Documentation', href: '/docs' },
    { name: 'GitHub', href: 'https://github.com' },
  ];

  const connectWallet = async () => {
    try {
      // Check if Phantom wallet is available
      if ('solana' in window && window.solana?.isPhantom && window.solana?.connect) {
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
        setWalletConnected(true);
        console.log('Connected to wallet:', response.publicKey.toString());
        // Fetch wallet tokens and portfolio data after connecting
        await Promise.all([fetchWalletTokens(), fetchPortfolioData()]);
      } else {
        // Fallback for other wallets or if Phantom is not installed
        alert('Please install Phantom wallet or use a supported wallet');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress('');
    setWalletTokens([]);
    if ('solana' in window && window.solana?.disconnect) {
      window.solana.disconnect();
    }
  };

  async function checkPoolExists(tokenA: string, tokenB: string) {
    if (!tokenA || !tokenB || !walletConnected) {
      setPoolExists(null);
      return;
    }

    setCheckingPool(true);
    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);
      const tokenAMintPubkey = new PublicKey(tokenA);
      const tokenBMintPubkey = new PublicKey(tokenB);

      const [ammPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenAMintPubkey.toBuffer(), tokenBMintPubkey.toBuffer()],
        ammProgramId
      );

      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), ammPDA.toBuffer()],
        ammProgramId
      );

      const poolAccount = await connection.getAccountInfo(poolPDA);
      setPoolExists(!!poolAccount);
    } catch (err) {
      console.error('Error checking pool:', err);
      setPoolExists(null);
    } finally {
      setCheckingPool(false);
    }
  }

  async function fetchWalletTokens() {
    if (!walletConnected) return;
    
    setLoadingTokens(true);
    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const provider = (window as any).solana;
      const userPublicKey = new PublicKey(provider.publicKey.toString());

      // Get all token accounts for the wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(userPublicKey, {
        programId: TOKEN_2022_PROGRAM_ID
      });

      const tokens = [];
      
      for (const tokenAccount of tokenAccounts.value) {
        const accountData = tokenAccount.account.data.parsed;
        const mintAddress = accountData.info.mint;
        const balance = accountData.info.tokenAmount.uiAmount || 0;
        const decimals = accountData.info.tokenAmount.decimals;
        
        // Only include tokens with balance > 0
        if (balance > 0) {
          try {
            // Try to get mint info to check for metadata
            const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
            
            tokens.push({
              mint: mintAddress,
              symbol: `Token ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
              balance,
              decimals
            });
          } catch (err) {
            console.warn('Could not fetch mint info for:', mintAddress);
          }
        }
      }

      // Also check for regular SPL tokens
      const splTokenAccounts = await connection.getParsedTokenAccountsByOwner(userPublicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      for (const tokenAccount of splTokenAccounts.value) {
        const accountData = tokenAccount.account.data.parsed;
        const mintAddress = accountData.info.mint;
        const balance = accountData.info.tokenAmount.uiAmount || 0;
        const decimals = accountData.info.tokenAmount.decimals;
        
        if (balance > 0) {
          tokens.push({
            mint: mintAddress,
            symbol: `SPL ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
            balance,
            decimals
          });
        }
      }

      setWalletTokens(tokens);
      console.log('Found tokens:', tokens);

      // Set default tokens if available
      if (tokens.length >= 2) {
        setFromToken(tokens[0].mint);
        setToToken(tokens[1].mint);
      } else if (tokens.length === 1) {
        setFromToken(tokens[0].mint);
      }

    } catch (err) {
      console.error('Failed to fetch wallet tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  }

  async function fetchPortfolioData() {
    if (!walletConnected) return;
    
    setLoadingPortfolio(true);
    console.log('🔍 Starting portfolio data fetch...');
    
    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const provider = (window as any).solana;
      const userPublicKey = new PublicKey(provider.publicKey.toString());

      console.log('👤 Wallet address:', userPublicKey.toString());

      // Fetch SOL balance
      const solBalance = await connection.getBalance(userPublicKey);
      const solBalanceFormatted = solBalance / 1e9;
      console.log('💰 SOL balance:', solBalanceFormatted);

      // Fetch token accounts (reuse wallet tokens logic)
      console.log('🔍 Fetching token accounts...');
      const [token2022Accounts, splTokenAccounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(userPublicKey, { programId: TOKEN_2022_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(userPublicKey, { programId: TOKEN_PROGRAM_ID })
      ]);

      console.log('📊 Token-2022 accounts found:', token2022Accounts.value.length);
      console.log('📊 SPL token accounts found:', splTokenAccounts.value.length);

      const allTokens = [];

      // Add SOL as base token
      allTokens.push({
        mint: 'SOL',
        symbol: 'SOL',
        balance: solBalanceFormatted,
        decimals: 9,
        usdValue: solBalanceFormatted * 50, // Mock price: $50/SOL
        change24h: Math.random() * 10 - 5 // Mock 24h change
      });

      // Process Token-2022 accounts
      for (const tokenAccount of token2022Accounts.value) {
        const accountData = tokenAccount.account.data.parsed;
        const mintAddress = accountData.info.mint;
        const balance = accountData.info.tokenAmount.uiAmount || 0;
        const decimals = accountData.info.tokenAmount.decimals;
        
        console.log(`🪙 Token-2022: ${mintAddress} - Balance: ${balance}`);
        
        // Include all tokens, even with 0 balance for debugging
        allTokens.push({
          mint: mintAddress,
          symbol: `T22-${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
          balance,
          decimals,
          usdValue: balance * (Math.random() * 100 + 1), // Mock USD value
          change24h: Math.random() * 20 - 10 // Mock 24h change
        });
      }

      // Process SPL Token accounts
      for (const tokenAccount of splTokenAccounts.value) {
        const accountData = tokenAccount.account.data.parsed;
        const mintAddress = accountData.info.mint;
        const balance = accountData.info.tokenAmount.uiAmount || 0;
        const decimals = accountData.info.tokenAmount.decimals;
        
        console.log(`🪙 SPL Token: ${mintAddress} - Balance: ${balance}`);
        
        // Include all tokens, even with 0 balance for debugging
        allTokens.push({
          mint: mintAddress,
          symbol: `SPL-${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
          balance,
          decimals,
          usdValue: balance * (Math.random() * 50 + 1), // Mock USD value
          change24h: Math.random() * 15 - 7.5 // Mock 24h change
        });
      }

      console.log('📈 Total tokens found:', allTokens.length);

      // Fetch liquidity pool positions
      const pools = await fetchUserPools(userPublicKey, connection);
      console.log('🏊 Pools found:', pools.length);

      // Fetch recent transactions
      const transactions = await fetchUserTransactions(userPublicKey, connection);
      console.log('📋 Transactions found:', transactions.length);

      // Calculate total portfolio value
      const totalValue = allTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0) +
                        pools.reduce((sum, pool) => sum + pool.liquidity, 0);

      console.log('💵 Total portfolio value:', totalValue);

      const portfolioUpdate = {
        totalValue,
        tokens: allTokens,
        pools,
        transactions
      };

      console.log('✅ Portfolio data ready:', portfolioUpdate);
      setPortfolioData(portfolioUpdate);

    } catch (err) {
      console.error('❌ Failed to fetch portfolio data:', err);
    } finally {
      setLoadingPortfolio(false);
    }
  }

  async function fetchUserPools(userPublicKey: PublicKey, connection: Connection) {
    try {
      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);
      
      // Get all AMM accounts for this user (simplified - in production you'd use getProgramAccounts)
      const pools = [];
      
      // For now, return mock data - in production you'd scan all pools where user has liquidity
      if (walletTokens.length >= 2) {
        pools.push({
          tokenA: walletTokens[0]?.mint || 'Unknown',
          tokenB: walletTokens[1]?.mint || 'Unknown',
          liquidity: Math.random() * 10000 + 1000, // Mock liquidity value
          fees24h: Math.random() * 100 + 10 // Mock fees earned
        });
      }
      
      return pools;
    } catch (err) {
      console.error('Failed to fetch user pools:', err);
      return [];
    }
  }

  async function fetchUserTransactions(userPublicKey: PublicKey, connection: Connection) {
    try {
      // Get recent transaction signatures
      const signatures = await connection.getSignaturesForAddress(userPublicKey, { limit: 20 });
      
      const transactions = [];
      
      for (const sigInfo of signatures.slice(0, 10)) { // Limit to 10 recent transactions
        try {
          const tx = await connection.getParsedTransaction(sigInfo.signature, { 
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0 
          });
          
          if (tx && tx.meta) {
            // Analyze transaction to determine type
            const instructions = tx.transaction.message.instructions;
            let txType: 'swap' | 'create_pool' | 'transfer' = 'transfer';
            
            for (const instruction of instructions) {
              if ('programId' in instruction) {
                if (instruction.programId.equals(new PublicKey(AMM_PROGRAM_ID))) {
                  // Check instruction data to determine if it's swap or create_pool
                  txType = Math.random() > 0.5 ? 'swap' : 'create_pool';
                  break;
                } else if (instruction.programId.equals(TOKEN_2022_PROGRAM_ID) || 
                          instruction.programId.equals(TOKEN_PROGRAM_ID)) {
                  txType = 'transfer';
                }
              }
            }
            
            transactions.push({
              type: txType,
              timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
              signature: sigInfo.signature,
              details: {
                status: tx.meta.err ? 'failed' : 'success',
                fee: tx.meta.fee / 1e9,
              }
            });
          }
        } catch (txErr) {
          console.warn('Could not parse transaction:', sigInfo.signature);
        }
      }
      
      return transactions;
    } catch (err) {
      console.error('Failed to fetch user transactions:', err);
      return [];
    }
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    setMintAddress('');
    try {
      // Connect to devnet
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      // @ts-ignore
      const provider = window.solana;
      
      // Check if Phantom is available
      if (!provider || !provider.isPhantom) {
        throw new Error('Phantom wallet not found. Please install Phantom wallet.');
      }
      
      // Check if wallet is already connected
      if (!provider.isConnected) {
        if (!provider.connect) {
          throw new Error('Phantom wallet connect method not found.');
        }
        await provider.connect();
      }
      
      // Check if we have the required methods
      console.log('Phantom provider methods:', Object.keys(provider));
      console.log('sendTransaction available:', !!provider.sendTransaction);
      console.log('signAndSendTransaction available:', !!provider.signAndSendTransaction);
      
      // Check for either sendTransaction or signAndSendTransaction
      if (!provider.sendTransaction && !provider.signAndSendTransaction) {
        throw new Error('Phantom wallet is missing required transaction methods. Please update Phantom or try refreshing the page.');
      }
      
      if (!provider.publicKey) {
        throw new Error('Wallet publicKey not found. Please connect your wallet.');
      }
      
      const userPublicKey = new PublicKey(provider.publicKey.toString());
      
      // Generate new mint keypair
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey;
      
      // 1. Create Mint Account with Transfer Hook Extension
      const extensions = [ExtensionType.TransferHook];
      const mintLen = getMintLen(extensions);
      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
      const createMintIx = SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: mint,
        lamports,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      });
      
      // 2. Initialize Transfer Hook Extension
      const transferHookProgramId = new PublicKey(TRANSFER_HOOK_PROGRAM_ID);
      const initTransferHookIx = createInitializeTransferHookInstruction(
        mint,
        userPublicKey,
        transferHookProgramId,
        TOKEN_2022_PROGRAM_ID
      );
      
      // 3. Initialize Mint
      const initMintIx = createInitializeMintInstruction(
        mint,
        Number(tokenDecimals),
        userPublicKey,
        userPublicKey,
        TOKEN_2022_PROGRAM_ID
      );
      
      // 4. Create ATA (Token-2022 compatible)
      const ata = await getAssociatedTokenAddress(
        mint,
        userPublicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const createAtaIx = createAssociatedTokenAccountInstruction(
        userPublicKey,
        ata,
        userPublicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // 5. MintTo
      const mintAmount = BigInt(parseFloat(tokenSupply) * Math.pow(10, Number(tokenDecimals)));
      const mintToIx = createMintToInstruction(
        mint,
        ata,
        userPublicKey,
        mintAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      
      // 6. Build transaction - Note: Transfer hook account initialization happens separately
      const tx = new Transaction().add(createMintIx, initTransferHookIx, initMintIx, createAtaIx, mintToIx);
      tx.feePayer = userPublicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      // 6. Send transaction with Phantom (try both methods)
      let sig: string;
      try {
      if (provider.sendTransaction) {
        sig = await provider.sendTransaction(tx, connection, { signers: [mintKeypair] });
      } else if (provider.signTransaction) {
        tx.partialSign(mintKeypair);
        const signedTx = await provider.signTransaction(tx);
        const raw = signedTx.serialize();
        sig = await connection.sendRawTransaction(raw);
      } else {
        throw new Error('No transaction sending method available');
      }
      
      await connection.confirmTransaction(sig, 'confirmed');
      
        // 7. Token created successfully
      setMintAddress(mint.toBase58());
        setCreateSuccess('Token-2022 with transfer hook created successfully! Note: Initialize the transfer hook account before transfers.');
      } catch (sendError: any) {
        if (sendError.message && sendError.message.includes('already been processed')) {
        setMintAddress(mint.toBase58());
          setCreateSuccess('Token-2022 with transfer hook created successfully! (Transaction may have been processed already)');
      } else {
          throw sendError;
      }
      }
    } catch (err: any) {
      console.error('Create token error:', err);
      setCreateError(err.message || 'Failed to create token');
    } finally {
      setCreating(false);
    }
  }

    // Initialize transfer hook account (ExtraAccountMetas)
  async function handleInitializeTransferHook(mintAddress: string) {
    if (!mintAddress) {
      setHookInitError('No mint address provided');
      return;
    }

    setInitializingHook(true);
    setHookInitError('');
    setHookInitSuccess('');

    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      // @ts-ignore
      const provider = window.solana;

      if (!provider || !provider.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      if (!provider.isConnected && provider.connect) {
        await provider.connect();
      }

      if (!provider.publicKey) {
        throw new Error('Wallet not connected');
      }

      const userPublicKey = new PublicKey(provider.publicKey.toString());
      const mint = new PublicKey(mintAddress);
      const transferHookProgramId = new PublicKey(TRANSFER_HOOK_PROGRAM_ID);

      // Get the ExtraAccountMetas PDA
      const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('extra-account-metas'),
          mint.toBuffer(),
        ],
        transferHookProgramId
      );

      // Check if the account already exists
      const existingAccount = await connection.getAccountInfo(extraAccountMetaListPDA);
      if (existingAccount) {
        setHookInitSuccess('Transfer hook account already initialized!');
        return;
      }

      // Create the initialize instruction using the correct discriminator
      // For Anchor programs, we need to calculate the discriminator properly
      const instructionName = "initialize_extra_account_meta_list";
      const preimage = `global:${instructionName}`;
      
      // Use Web Crypto API to calculate SHA256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(preimage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);
      
      console.log('Using discriminator:', Array.from(discriminator));
      console.log('Program ID:', transferHookProgramId.toBase58());
      console.log('ExtraAccountMetas PDA:', extraAccountMetaListPDA.toBase58());
      
      const initializeInstruction = new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: extraAccountMetaListPDA, isSigner: false, isWritable: true }, // extra_account_meta_list
          { pubkey: mint, isSigner: false, isWritable: false }, // mint
          { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: transferHookProgramId,
        data: Buffer.from(discriminator),
      });

      const transaction = new Transaction().add(initializeInstruction);
      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign and send transaction
      if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        
        try {
          const signature = await connection.sendRawTransaction(rawTransaction);
          await connection.confirmTransaction(signature, 'confirmed');
          setHookInitSuccess(`Transfer hook account initialized successfully! Signature: ${signature}`);
        } catch (sendError: any) {
          console.error('Send transaction error:', sendError);
          if (sendError.message && sendError.message.includes('already been processed')) {
            setHookInitSuccess('Transfer hook account initialization successful! (Transaction may have been processed already)');
          } else if (sendError.message && sendError.message.includes('invalid instruction data')) {
            setHookInitError('Invalid instruction data. This might be due to a discriminator mismatch. Please check the browser console for details.');
          } else {
            throw sendError;
          }
        }
      } else {
        throw new Error('Phantom signTransaction method not available');
      }
      
    } catch (err: any) {
      console.error('Transfer hook initialization error:', err);
      setHookInitError(err.message || 'Failed to initialize transfer hook account');
    } finally {
      setInitializingHook(false);
    }
  }

  // Transfer tokens with transfer hook
  async function handleTransferWithHook(e: React.FormEvent) {
    e.preventDefault();
    
    if (!mintAddress || !recipientAddress || !transferAmount) {
      setTransferError('Please provide mint address, recipient address, and transfer amount');
      return;
    }

    setTransferring(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      // @ts-ignore
      const provider = window.solana;
      
      if (!provider || !provider.isPhantom) {
        throw new Error('Phantom wallet not found');
      }
      
      if (!provider.isConnected && provider.connect) {
        await provider.connect();
      }
      
      if (!provider.publicKey) {
        throw new Error('Wallet not connected');
      }
      
      const userPublicKey = new PublicKey(provider.publicKey.toString());
      const mint = new PublicKey(mintAddress);
      const recipient = new PublicKey(recipientAddress);
      
      // Get source and destination token accounts
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mint,
        userPublicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      const destinationTokenAccount = await getAssociatedTokenAddress(
        mint,
        recipient,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Check if destination ATA exists, create if needed
      const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
      const createDestinationAtaIx = !destinationAccountInfo ? 
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          destinationTokenAccount,
          recipient,
          mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ) : null;
      
      // Create transfer instruction with transfer hook support manually
      const transferAmountBigInt = BigInt(parseFloat(transferAmount) * Math.pow(10, Number(tokenDecimals)));
      
      // Get the ExtraAccountMetas PDA for the transfer hook
      const transferHookProgramId = new PublicKey(TRANSFER_HOOK_PROGRAM_ID);
      const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('extra-account-metas'), mint.toBuffer()],
        transferHookProgramId
      );

      // Create a basic TransferChecked instruction
      const transferInstruction = createTransferCheckedInstruction(
        sourceTokenAccount,
        mint,
        destinationTokenAccount,
        userPublicKey,
        transferAmountBigInt,
        Number(tokenDecimals),
        [],
        TOKEN_2022_PROGRAM_ID
      );

      // Add the transfer hook program and extra account metas as additional accounts
      transferInstruction.keys.push(
        { pubkey: transferHookProgramId, isSigner: false, isWritable: false },
        { pubkey: extraAccountMetaListPDA, isSigner: false, isWritable: false }
      );
      
      // Build transaction
      const transaction = new Transaction();
      if (createDestinationAtaIx) {
        transaction.add(createDestinationAtaIx);
      }
      transaction.add(transferInstruction);
      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      // Sign and send transaction
      if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        
        try {
          const signature = await connection.sendRawTransaction(rawTransaction);
          await connection.confirmTransaction(signature, 'confirmed');
          setTransferSuccess(`Transfer with transfer hook successful! Signature: ${signature}`);
          setRecipientAddress('');
          setTransferAmount('');
        } catch (sendError: any) {
          if (sendError.message && sendError.message.includes('already been processed')) {
            setTransferSuccess('Transfer with transfer hook successful! (Transaction may have been processed already)');
            setRecipientAddress('');
            setTransferAmount('');
          } else {
            throw sendError;
          }
        }
      } else {
        throw new Error('Phantom signTransaction method not available');
      }

    } catch (err: any) {
      console.error('Transfer with hook error:', err);
      setTransferError(err.message || 'Failed to transfer tokens with hook');
    } finally {
      setTransferring(false);
    }
  }

  async function handleInitializeAmm(tokenAMint: string, tokenBMint: string) {
    setInitializingAmm(true);
    setAmmError('');
    setAmmSuccess('');

    try {
      if (!walletConnected) {
        throw new Error('Please connect your wallet first');
      }

      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const provider = (window as any).solana;
      const userPublicKey = new PublicKey(provider.publicKey.toString());

      const tokenAMintPubkey = new PublicKey(tokenAMint);
      const tokenBMintPubkey = new PublicKey(tokenBMint);
      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);

      // Derive AMM PDA (simplified version doesn't need vault PDAs)
      const [ammPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenAMintPubkey.toBuffer(), tokenBMintPubkey.toBuffer()],
        ammProgramId
      );

      // Calculate discriminator for initialize_amm
      const instructionName = "initialize_amm";
      const preimage = `global:${instructionName}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(preimage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      // Create instruction data: discriminator + pool_fee (u64) + pool_fee_denominator (u64)
      const poolFee = BigInt(25); // 0.25% fee
      const poolFeeDenominator = BigInt(10000);
      const instructionData = new Uint8Array(8 + 8 + 8);
      instructionData.set(discriminator, 0);

      // Write fee parameters as little-endian
      const feeBytes = new Uint8Array(8);
      const denominatorBytes = new Uint8Array(8);
      
      for (let i = 0; i < 8; i++) {
        feeBytes[i] = Number((poolFee >> BigInt(8 * i)) & BigInt(0xff));
        denominatorBytes[i] = Number((poolFeeDenominator >> BigInt(8 * i)) & BigInt(0xff));
      }
      
      instructionData.set(feeBytes, 8);
      instructionData.set(denominatorBytes, 16);

      const initializeAmmInstruction = new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: ammPDA, isSigner: false, isWritable: true },
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: tokenAMintPubkey, isSigner: false, isWritable: false },
          { pubkey: tokenBMintPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: ammProgramId,
        data: Buffer.from(instructionData),
      });

      const transaction = new Transaction().add(initializeAmmInstruction);
      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log('Initializing AMM with:', {
        ammPDA: ammPDA.toBase58(),
        tokenAMint: tokenAMint,
        tokenBMint: tokenBMint,
        discriminator: Array.from(discriminator),
      });

      // Sign and send transaction
      if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        
        try {
          const signature = await connection.sendRawTransaction(rawTransaction);
          await connection.confirmTransaction(signature, 'confirmed');
          setAmmSuccess(`AMM initialized successfully! Signature: ${signature}\nAMM Address: ${ammPDA.toBase58()}`);
        } catch (sendError: any) {
          if (sendError.message && sendError.message.includes('already been processed')) {
            setAmmSuccess('AMM initialization successful! (Transaction may have been processed already)');
          } else {
            throw sendError;
          }
        }
      } else {
        throw new Error('Phantom signTransaction method not available');
      }

    } catch (err: any) {
      console.error('AMM initialization error:', err);
      setAmmError(err.message || 'Failed to initialize AMM');
    } finally {
      setInitializingAmm(false);
    }
  }

  async function handleCreatePool(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPool(true);
    setPoolError('');
    setPoolSuccess('');

    try {
      if (!walletConnected) {
        throw new Error('Please connect your wallet first');
      }

      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const provider = (window as any).solana;
      const userPublicKey = new PublicKey(provider.publicKey.toString());

      // Validate inputs - use fallback values
      const effectiveTokenAMint = tokenAMint || mintAddress;
      const effectiveTokenBMint = tokenBMint;
      const effectiveTokenAAmount = tokenAAmount;
      const effectiveTokenBAmount = tokenBAmount;
      
      console.log('Form validation - State values:', {
        tokenAMint,
        tokenBMint, 
        tokenAAmount,
        tokenBAmount,
        mintAddress,
        effectiveTokenAMint,
        effectiveTokenBMint,
        effectiveTokenAAmount,
        effectiveTokenBAmount
      });
      
      if (!effectiveTokenAMint || !effectiveTokenBMint || !effectiveTokenAAmount || !effectiveTokenBAmount) {
        throw new Error(`Please fill in all fields. Missing: ${[
          !effectiveTokenAMint ? 'Token A Mint' : '',
          !effectiveTokenBMint ? 'Token B Mint' : '', 
          !effectiveTokenAAmount ? 'Token A Amount' : '',
          !effectiveTokenBAmount ? 'Token B Amount' : ''
        ].filter(Boolean).join(', ')}`);
      }

      const tokenAMintPubkey = new PublicKey(effectiveTokenAMint);
      const tokenBMintPubkey = new PublicKey(effectiveTokenBMint);
      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);

      // Derive PDAs
      const [ammPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenAMintPubkey.toBuffer(), tokenBMintPubkey.toBuffer()],
        ammProgramId
      );

      // Check if AMM is initialized
      const ammAccount = await connection.getAccountInfo(ammPDA);
      if (!ammAccount) {
        console.log('AMM not initialized, initializing first...');
        await handleInitializeAmm(effectiveTokenAMint, effectiveTokenBMint);
        // Wait a bit for the transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), ammPDA.toBuffer()],
        ammProgramId
      );

      // Check if pool already exists
      try {
        const poolAccount = await connection.getAccountInfo(poolPDA);
        if (poolAccount) {
          throw new Error(`Pool already exists for this token pair!\n\nToken A: ${effectiveTokenAMint}\nToken B: ${effectiveTokenBMint}\n\nYou can go to the "Trade" tab to use the existing pool for swapping.`);
        }
      } catch (poolCheckError: any) {
        if (poolCheckError.message.includes('Pool already exists')) {
          throw poolCheckError;
        }
        // If it's a different error, continue (pool probably doesn't exist)
        console.log('Pool does not exist yet, proceeding with creation');
      }

      // Simplified version - just validate that mints exist
      const tokenAMintInfo = await connection.getAccountInfo(tokenAMintPubkey);
      const tokenBMintInfo = await connection.getAccountInfo(tokenBMintPubkey);
      
      if (!tokenAMintInfo || !tokenBMintInfo) {
        throw new Error('Invalid token mint addresses');
      }

      // Use standard 9 decimals for Token-2022
      const decimals = 9;
      const tokenAAmountBigInt = BigInt(parseFloat(effectiveTokenAAmount) * Math.pow(10, decimals));
      const tokenBAmountBigInt = BigInt(parseFloat(effectiveTokenBAmount) * Math.pow(10, decimals));

      // Create pool instruction data (browser-compatible)
      // Calculate the correct discriminator for create_pool
      const instructionName = "create_pool";
      const preimage = `global:${instructionName}`;
      
      // Use Web Crypto API to calculate SHA256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(preimage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);
      
      const instructionData = new Uint8Array(8 + 8 + 8); // discriminator + 2 u64s
      instructionData.set(discriminator, 0);
      
      // Convert BigInt to little-endian bytes manually (browser-compatible)
      const tokenABytes = new Uint8Array(8);
      const tokenBBytes = new Uint8Array(8);
      
      // Write tokenAAmountBigInt as little-endian
      for (let i = 0; i < 8; i++) {
        tokenABytes[i] = Number((tokenAAmountBigInt >> BigInt(8 * i)) & BigInt(0xff));
      }
      
      // Write tokenBAmountBigInt as little-endian  
      for (let i = 0; i < 8; i++) {
        tokenBBytes[i] = Number((tokenBAmountBigInt >> BigInt(8 * i)) & BigInt(0xff));
      }
      
      // Copy bytes to instruction data
      instructionData.set(tokenABytes, 8);
      instructionData.set(tokenBBytes, 16);

      const createPoolInstruction = new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: poolPDA, isSigner: false, isWritable: true },
          { pubkey: ammPDA, isSigner: false, isWritable: false },
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: tokenAMintPubkey, isSigner: false, isWritable: false },
          { pubkey: tokenBMintPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: ammProgramId,
        data: Buffer.from(instructionData),
      });

      const transaction = new Transaction().add(createPoolInstruction);
      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log('Creating pool with:', {
        tokenA: effectiveTokenAMint,
        tokenB: effectiveTokenBMint,
        amountA: effectiveTokenAAmount,
        amountB: effectiveTokenBAmount,
        tokenAAmountBigInt: tokenAAmountBigInt.toString(),
        tokenBAmountBigInt: tokenBAmountBigInt.toString(),
        poolPDA: poolPDA.toBase58(),
        ammPDA: ammPDA.toBase58(),
        discriminator: Array.from(discriminator),
        instructionData: Array.from(instructionData),
        ammProgramId: ammProgramId.toBase58(),
      });
      
      // Sign and send transaction
      if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        
        try {
          const signature = await connection.sendRawTransaction(rawTransaction);
          await connection.confirmTransaction(signature, 'confirmed');
          setPoolSuccess(`Pool created successfully! Signature: ${signature}\nPool Address: ${poolPDA.toBase58()}`);
          
          // Reset form
          setTokenAMint('');
          setTokenBMint('');
          setTokenAAmount('');
          setTokenBAmount('');
        } catch (sendError: any) {
          if (sendError.message && sendError.message.includes('already been processed')) {
            setPoolSuccess('Pool creation successful! (Transaction may have been processed already)');
          } else {
            throw sendError;
          }
        }
      } else {
        throw new Error('Phantom signTransaction method not available');
      }

    } catch (err: any) {
      console.error('Pool creation error:', err);
      setPoolError(err.message || 'Failed to create pool');
    } finally {
      setCreatingPool(false);
    }
  }

  // Calculate swap output using constant product formula
  function calculateSwapOutput(amountIn: number, reserveIn: number, reserveOut: number) {
    const fee = 25; // 0.25%
    const feeDenominator = 10000;
    
    const amountInWithFee = amountIn * (feeDenominator - fee) / feeDenominator;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    
    return numerator / denominator;
  }

  // Update swap estimates when amount changes
  function updateSwapEstimate(amount: string) {
    if (!amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
      setEstimatedOutput('0.0');
      setPriceImpact('0.00%');
      return;
    }

    const amountNum = parseFloat(amount);
    const reserveA = 1000; // Pool reserves: 1000 tokens each
    const reserveB = 1000; // Pool reserves: 1000 tokens each
    
    // Use the same calculation as the program
    const output = calculateSwapOutput(amountNum, reserveA, reserveB);
    const impact = (amountNum / reserveA) * 100;
    
    setEstimatedOutput(output.toFixed(6));
    setPriceImpact(impact.toFixed(2) + '%');
  }

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault();
    setSwapping(true);
    setSwapError('');
    setSwapSuccess('');

    try {
      if (!walletConnected) {
        throw new Error('Please connect your wallet first');
      }

      if (!swapAmount || parseFloat(swapAmount) <= 0) {
        throw new Error('Please enter a valid swap amount');
      }

      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const provider = (window as any).solana;
      const userPublicKey = new PublicKey(provider.publicKey.toString());

      // Use the selected tokens from wallet
      if (!fromToken || !toToken) {
        throw new Error('Please select both from and to tokens.');
      }

      const tokenAMintPubkey = new PublicKey(fromToken);
      const tokenBMintPubkey = new PublicKey(toToken);
      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);

      // Derive PDAs
      const [ammPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenAMintPubkey.toBuffer(), tokenBMintPubkey.toBuffer()],
        ammProgramId
      );

      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), ammPDA.toBuffer()],
        ammProgramId
      );

      // Check if pool exists and has liquidity
      try {
        const poolAccount = await connection.getAccountInfo(poolPDA);
        if (!poolAccount) {
          throw new Error(`No liquidity pool found for this token pair. Please create a pool first using the "Create Pool" tab with these tokens:\n\nToken A: ${fromToken}\nToken B: ${toToken}`);
        }
        
        // Parse pool data to check if it has liquidity
        if (poolAccount.data.length >= 24) { // Assuming u64 + u64 + u64 = 24 bytes minimum
          const tokenAAmount = new DataView(poolAccount.data.buffer).getBigUint64(8, true); // Skip discriminator
          const tokenBAmount = new DataView(poolAccount.data.buffer).getBigUint64(16, true);
          
          console.log('Raw pool data inspection:', {
            dataLength: poolAccount.data.length,
            rawBytes: Array.from(poolAccount.data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '),
            tokenAAmount: tokenAAmount.toString(), 
            tokenBAmount: tokenBAmount.toString(),
            tokenAFormatted: (Number(tokenAAmount) / 1e9).toFixed(4),
            tokenBFormatted: (Number(tokenBAmount) / 1e9).toFixed(4)
          });
          
          if (tokenAAmount === BigInt(0) || tokenBAmount === BigInt(0)) {
            throw new Error(`Pool exists but has no liquidity. The pool has 0 reserves for one or both tokens. Please add liquidity to the pool first.`);
          }
          
          // Check if the amounts seem too small (less than 1 token)
          if (tokenAAmount < BigInt(1e9) || tokenBAmount < BigInt(1e9)) {
            throw new Error(`Pool has very low liquidity. Token A: ${(Number(tokenAAmount) / 1e9).toFixed(4)}, Token B: ${(Number(tokenBAmount) / 1e9).toFixed(4)}. This may cause swap calculation issues.`);
          }
        }
      } catch (poolCheckError: any) {
        if (poolCheckError.message.includes('No liquidity pool found') || poolCheckError.message.includes('has no liquidity')) {
          throw poolCheckError;
        }
        // If it's a different error, continue (account might exist but have other issues)
        console.warn('Could not verify pool liquidity:', poolCheckError);
      }

      // Calculate amounts
      const decimals = 9;
      const amountIn = BigInt(parseFloat(swapAmount) * Math.pow(10, decimals));
      const minimumAmountOut = BigInt(parseFloat(estimatedOutput) * 0.5 * Math.pow(10, decimals)); // 50% slippage tolerance for large swaps

      // Calculate discriminator for swap
      const instructionName = "swap";
      const preimage = `global:${instructionName}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(preimage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      // Create instruction data: discriminator + amount_in (u64) + minimum_amount_out (u64)
      const instructionData = new Uint8Array(8 + 8 + 8);
      instructionData.set(discriminator, 0);

      // Write amounts as little-endian
      const amountInBytes = new Uint8Array(8);
      const minAmountOutBytes = new Uint8Array(8);
      
      for (let i = 0; i < 8; i++) {
        amountInBytes[i] = Number((amountIn >> BigInt(8 * i)) & BigInt(0xff));
        minAmountOutBytes[i] = Number((minimumAmountOut >> BigInt(8 * i)) & BigInt(0xff));
      }
      
      instructionData.set(amountInBytes, 8);
      instructionData.set(minAmountOutBytes, 16);

      const swapInstruction = new anchor.web3.TransactionInstruction({
        keys: [
          { pubkey: poolPDA, isSigner: false, isWritable: true },
          { pubkey: ammPDA, isSigner: false, isWritable: false },
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: tokenAMintPubkey, isSigner: false, isWritable: false },
          { pubkey: tokenBMintPubkey, isSigner: false, isWritable: false },
        ],
        programId: ammProgramId,
        data: Buffer.from(instructionData),
      });

      const transaction = new Transaction().add(swapInstruction);
      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log('Swapping with details:', {
        from: fromToken,
        to: toToken,
        amountIn: swapAmount,
        amountInBigInt: amountIn.toString(),
        minimumAmountOut: minimumAmountOut.toString(),
        estimatedOutput,
        priceImpact,
        poolPDA: poolPDA.toString(),
        ammPDA: ammPDA.toString()
      });

      // Sign and send transaction
      if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        
        try {
          const signature = await connection.sendRawTransaction(rawTransaction);
          await connection.confirmTransaction(signature, 'confirmed');
          setSwapSuccess(`Swap successful! Signature: ${signature}`);
          
          // Reset form
          setSwapAmount('');
          setEstimatedOutput('0.0');
          setPriceImpact('0.00%');
        } catch (sendError: any) {
          if (sendError.message && sendError.message.includes('already been processed')) {
            setSwapSuccess('Swap successful! (Transaction may have been processed already)');
          } else {
            throw sendError;
          }
        }
      } else {
        throw new Error('Phantom signTransaction method not available');
      }

    } catch (err: any) {
      console.error('Swap error:', err);
      let errorMessage = err.message || 'Failed to execute swap';
      
      // Handle specific program errors
      if (err.message && err.message.includes('Program failed to complete')) {
        errorMessage = 'Swap failed due to insufficient liquidity or invalid pool state. Please ensure the pool has adequate liquidity for both tokens.';
      } else if (err.message && err.message.includes('SBF program panicked')) {
        errorMessage = 'Pool calculation error. This usually means the pool has zero reserves or invalid state. Please check if the pool was created with proper liquidity.';
      }
      
      setSwapError(errorMessage);
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/Galactic%20-%2028.png"
          alt="Galactic Background"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-orange-600/20" />
        <motion.div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Floating Brand Logos */}
        <motion.div
          className="absolute top-20 left-20 w-16 h-16 opacity-10"
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Solana Logo */}
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <defs>
              <linearGradient id="solanaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#9945FF'}} />
                <stop offset="100%" style={{stopColor: '#14F195'}} />
              </linearGradient>
            </defs>
            <path d="M64 320L336 48H400L128 320H64Z" fill="url(#solanaGradient)" />
            <path d="M64 208L336 -64H400L128 208H64Z" fill="url(#solanaGradient)" />
            <path d="M64 96L336 368H400L128 96H64Z" fill="url(#solanaGradient)" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute top-40 right-32 w-12 h-12 opacity-8"
          animate={{
            y: [0, 15, 0],
            x: [0, -10, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Phantom Wallet Logo */}
          <svg viewBox="0 0 128 128" className="w-full h-full">
            <defs>
              <linearGradient id="phantomGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#AB9FF2'}} />
                <stop offset="100%" style={{stopColor: '#4E44CE'}} />
              </linearGradient>
            </defs>
            <path d="M96 8C96 3.6 92.4 0 88 0H40C35.6 0 32 3.6 32 8V120C32 124.4 35.6 128 40 128H88C92.4 128 96 124.4 96 120V8Z" fill="url(#phantomGradient)" />
            <circle cx="52" cy="40" r="4" fill="white" />
            <circle cx="76" cy="40" r="4" fill="white" />
            <path d="M48 60C48 56 52 52 64 52S80 56 80 60V72H48V60Z" fill="white" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute bottom-32 left-40 w-14 h-14 opacity-12"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          {/* Token-2022 Logo */}
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
            T22
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-20 right-20 w-10 h-10 opacity-8"
          animate={{
            y: [0, -25, 0],
            rotate: [0, -15, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* DeFi Symbol */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="defiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#00D4AA'}} />
                <stop offset="100%" style={{stopColor: '#0066FF'}} />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#defiGradient)" strokeWidth="8" />
            <path d="M30 35L50 55L70 35M30 65L50 45L70 65" stroke="url(#defiGradient)" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute top-60 right-16 w-8 h-8 opacity-6"
          animate={{
            x: [0, 20, 0],
            y: [0, -15, 0],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* AMM Symbol */}
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-xs">
            ⚡
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-60 right-60 w-6 h-6 opacity-10"
          animate={{
            rotate: [0, -360],
            scale: [1, 0.8, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Swap Symbol */}
          <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-xs">
            🔄
          </div>
        </motion.div>
      </div>

      {/* Modern Navigation Bar */}
      <motion.nav 
        className="relative z-10 bg-black/20 backdrop-blur-md border-b border-white/10"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div 
                className="w-10 h-10 relative"
                animate={{ 
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                {/* Cool Crypto DEX Logo */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor: '#FF6B35'}} />
                      <stop offset="50%" style={{stopColor: '#F7931E'}} />
                      <stop offset="100%" style={{stopColor: '#9D4EDD'}} />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Outer ring */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="3" opacity="0.8" />
                  
                  {/* Inner hexagon */}
                  <polygon points="50,15 75,30 75,60 50,75 25,60 25,30" fill="url(#logoGradient)" opacity="0.9" />
                  
                  {/* Center diamond */}
                  <polygon points="50,25 65,40 50,55 35,40" fill="white" />
                  
                  {/* Connecting lines */}
                  <line x1="50" y1="15" x2="50" y2="25" stroke="url(#logoGradient)" strokeWidth="2" />
                  <line x1="75" y1="30" x2="65" y2="40" stroke="url(#logoGradient)" strokeWidth="2" />
                  <line x1="75" y1="60" x2="65" y2="40" stroke="url(#logoGradient)" strokeWidth="2" />
                  <line x1="50" y1="75" x2="50" y2="55" stroke="url(#logoGradient)" strokeWidth="2" />
                  <line x1="25" y1="60" x2="35" y2="40" stroke="url(#logoGradient)" strokeWidth="2" />
                  <line x1="25" y1="30" x2="35" y2="40" stroke="url(#logoGradient)" strokeWidth="2" />
                  
                  {/* Small accent dots */}
                  <circle cx="50" cy="40" r="2" fill="url(#logoGradient)" />
                  <circle cx="45" cy="45" r="1.5" fill="white" />
                  <circle cx="55" cy="45" r="1.5" fill="white" />
                </svg>
              </motion.div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                Token-2022 AMM
              </h1>
            </motion.div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-2">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : '_self'}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="text-gray-300 hover:text-white transition-all duration-300 font-medium px-4 py-2 rounded-xl hover:bg-white/10 flex items-center space-x-2"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {link.name === 'Features' && <span>✨</span>}
                  {link.name === 'Documentation' && <span>📚</span>}
                  {link.name === 'GitHub' && <span>🔗</span>}
                  <span>{link.name}</span>
                  {link.href.startsWith('http') && (
                    <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                    </svg>
                  )}
                </motion.a>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <motion.button
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </motion.button>
            </div>

            {/* Right Side Buttons */}
            <div className="flex items-center space-x-4">
              {/* Wallet Connect Button */}
              {!walletConnected ? (
                <motion.button 
                  className="bg-gradient-to-r from-orange-500 to-purple-600 text-white px-6 py-2.5 rounded-2xl font-semibold hover:shadow-2xl hover:shadow-orange-500/25 transition-all duration-500 flex items-center space-x-2"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={connectWallet}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Connect Wallet</span>
                </motion.button>
              ) : (
                <motion.div
                  className="flex items-center space-x-3 bg-black/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/20 shadow-xl"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                    <span className="text-sm text-white font-semibold">
                      {shortenAddress(walletAddress)}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => {
                      setWalletConnected(false);
                      setWalletAddress('');
                      // Reset portfolio and token data
                      setPortfolioData({
                        totalValue: 0,
                        tokens: [],
                        pools: [],
                        transactions: []
                      });
                      setWalletTokens([]);
                    }}
                    className="text-gray-400 hover:text-red-400 transition-colors duration-200 p-1 rounded-lg hover:bg-red-500/10"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Disconnect wallet"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </motion.button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.div
            className="inline-block mb-4 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-400 text-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Get early access Token-2022 AMM beta
          </motion.div>
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-orange-200 to-purple-200 bg-clip-text text-transparent"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Meet! Token-2022 AMM
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            Built for a secure Web3 future. Empowering Solana with programmable transfer hooks and decentralized trading.
          </motion.p>
          <motion.div 
            className="flex justify-center"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <motion.div
              className="bg-gradient-to-r from-orange-500/10 to-purple-600/10 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-2xl font-medium"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
            >
              🚀 Ready to trade Token-2022 with Transfer Hooks
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Modern Tab Navigation */}
        <motion.div 
          className="mb-12"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-3 shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {tabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                  className={`relative group px-4 py-4 rounded-2xl font-medium transition-all duration-500 overflow-hidden ${
                  activeTab === tab.id
                      ? 'bg-gradient-to-br from-orange-500 to-purple-600 text-white shadow-2xl shadow-orange-500/25'
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/20'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.4 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Background glow effect */}
                  {activeTab === tab.id && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-purple-600/30 blur-xl"
                      layoutId="tabGlow"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.8 }}
                    />
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <motion.div 
                      className="text-2xl mb-2"
                      animate={{ scale: activeTab === tab.id ? 1.2 : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {tab.icon}
                    </motion.div>
                    <div className="text-sm font-semibold">{tab.name}</div>
                    <div className={`text-xs mt-1 transition-all duration-300 ${
                      activeTab === tab.id ? 'text-white/90' : 'text-gray-400'
                    }`}>
                      {tab.name === 'Overview' && 'Dashboard'}
                      {tab.name === 'Create Token' && 'New Token'}
                      {tab.name === 'Create Pool' && 'Liquidity'}
                      {tab.name === 'Trade' && 'Swap Tokens'}
                      {tab.name === 'Portfolio' && 'Your Assets'}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {activeTab === tab.id && (
                    <motion.div
                      className="absolute bottom-0 left-1/2 w-8 h-1 bg-white rounded-full"
                      layoutId="activeIndicator"
                      initial={{ x: '-50%' }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  {/* Hover effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                  />
              </motion.button>
            ))}
            </div>
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div 
          className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Welcome Section */}
                <motion.div 
                  className="text-center mb-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Welcome to the Future of DeFi
                  </h2>
                  <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                    The first AMM to fully support Token-2022 with Transfer Hooks, enabling compliant and programmable trading
                  </p>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                  {[
                    { title: 'Total Volume', value: '$2.4M', change: '+12.5%', icon: '📈', color: 'from-green-500 to-emerald-500' },
                    { title: 'Active Pools', value: '24', change: '+3', icon: '🏊', color: 'from-blue-500 to-cyan-500' },
                    { title: 'Total Tokens', value: '156', change: '+8', icon: '🪙', color: 'from-purple-500 to-violet-500' },
                    { title: 'Connected Users', value: '1.2K', change: '+5.2%', icon: '👥', color: 'from-orange-500 to-red-500' }
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.title}
                      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl`}>
                          {stat.icon}
                        </div>
                        <div className="text-green-400 text-sm font-medium">{stat.change}</div>
                      </div>
                      <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                      <div className="text-gray-400 text-sm">{stat.title}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Feature Cards */}
                <div className="grid md:grid-cols-2 gap-8">
                  <motion.div 
                    className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 p-8 rounded-3xl border border-blue-500/20 backdrop-blur-xl"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                  >
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-3xl mr-4">
                        🎯
                      </div>
                      <h3 className="text-2xl font-bold text-blue-400">Problem We Solve</h3>
                    </div>
                    <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                      Major AMMs don't support Token-2022 with Transfer Hooks, creating a gap for compliant and programmable tokens.
                    </p>
                    <div className="space-y-3">
                      {[
                        'Real-World Assets (RWA) with compliance requirements',
                        'Enterprise tokens with built-in KYC/AML',
                        'Programmable tokens with custom business logic',
                        'Regulated financial instruments requiring approvals'
                      ].map((item, index) => (
                        <motion.div
                          key={index}
                          className="flex items-center text-gray-300"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                        >
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                          {item}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 p-8 rounded-3xl border border-green-500/20 backdrop-blur-xl"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                  >
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-3xl mr-4">
                        🚀
                      </div>
                      <h3 className="text-2xl font-bold text-green-400">Our Innovation</h3>
                    </div>
                    <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                      Complete AMM infrastructure that makes Token-2022 with Transfer Hooks fully tradable and compliant.
                    </p>
                    <div className="space-y-3">
                      {[
                        'Custom AMM with native transfer hook validation',
                        'Advanced transfer hook program architecture',
                        'Modern, intuitive trading interface',
                        'Real-time analytics and portfolio tracking'
                      ].map((item, index) => (
                        <motion.div
                          key={index}
                          className="flex items-center text-gray-300"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                        >
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                          {item}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                <motion.div 
                  className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-8 rounded-xl border border-purple-500/20"
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-2xl font-bold mb-6 text-center text-purple-400">Key Features</h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { icon: '🔗', title: 'Transfer Hook Support', desc: 'Full integration with Token-2022 transfer hooks for programmable transfers', color: 'blue' },
                      { icon: '💰', title: 'Liquidity Pools', desc: 'Create and manage liquidity pools with automatic fee collection', color: 'green' },
                      { icon: '📊', title: 'Real-time Trading', desc: 'Swap tokens with slippage protection and real-time price updates', color: 'purple' },
                    ].map((feature, index) => (
                      <motion.div 
                        key={feature.title}
                        className="text-center"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <div className={`bg-${feature.color}-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-${feature.color}-500/30`}>
                          <span className="text-2xl">{feature.icon}</span>
                        </div>
                        <h4 className="font-semibold mb-2 text-white">{feature.title}</h4>
                        <p className="text-gray-300 text-sm">{feature.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'create-token' && (
              <motion.div
                key="create-token"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Header Section */}
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mr-4">
                      🪙
                    </div>
                    <div className="text-left">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                        Create Token-2022
                      </h2>
                      <p className="text-gray-400">With Transfer Hook Support</p>
                    </div>
                  </div>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                    Create advanced tokens with built-in transfer hooks for compliance, programmability, and custom business logic.
                  </p>
                  </motion.div>

                {/* Main Form Card */}
                <motion.div
                  className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <form onSubmit={handleCreateToken} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.5, delay: 0.3 }}
                      >
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                            Token Name
                          </span>
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={tokenName} 
                            onChange={e => setTokenName(e.target.value)} 
                            required 
                            className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 hover:border-white/30" 
                            placeholder="e.g., My Awesome Token" 
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            📝
                          </div>
                        </div>
                  </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.5, delay: 0.4 }}
                      >
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                            Token Symbol
                          </span>
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={tokenSymbol} 
                            onChange={e => setTokenSymbol(e.target.value.toUpperCase())} 
                            required 
                            maxLength={10}
                            className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 hover:border-white/30" 
                            placeholder="e.g., MAT" 
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            🏷️
                          </div>
                        </div>
                  </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.5, delay: 0.5 }}
                      >
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            Decimals
                          </span>
                        </label>
                        <div className="relative">
                          <select 
                            value={tokenDecimals} 
                            onChange={e => setTokenDecimals(Number(e.target.value))} 
                            required 
                            className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white transition-all duration-300 hover:border-white/30 appearance-none" 
                          >
                            {[0,1,2,3,4,5,6,7,8,9].map(dec => (
                              <option key={dec} value={dec} className="bg-black text-white">
                                {dec} {dec === 9 ? '(Standard)' : dec === 6 ? '(USDC-like)' : ''}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            🔢
                          </div>
                        </div>
                  </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.5, delay: 0.6 }}
                      >
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            Initial Supply
                          </span>
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={tokenSupply} 
                            onChange={e => setTokenSupply(e.target.value)} 
                            required 
                            min="1"
                            className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 hover:border-white/30" 
                            placeholder="1000000000" 
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            💰
                  </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Submit Button */}
                    <motion.div
                      className="pt-4"
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ duration: 0.5, delay: 0.7 }}
                    >
                      <motion.button 
                        type="submit" 
                        disabled={creating} 
                        className="w-full bg-gradient-to-r from-orange-500 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-orange-500/25 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                        whileHover={{ scale: creating ? 1 : 1.02 }} 
                        whileTap={{ scale: creating ? 1 : 0.98 }}
                      >
                        {creating && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-orange-600 to-purple-700"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          />
                        )}
                        <span className="relative z-10 flex items-center justify-center">
                          {creating ? (
                            <>
                              <motion.div
                                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              />
                              Creating Token...
                            </>
                          ) : (
                            <>
                              <span className="mr-2">🚀</span>
                              Create Token
                            </>
                          )}
                        </span>
                      </motion.button>
                    </motion.div>
                </form>

                  {/* Status Messages */}
                  <AnimatePresence>
                    {createError && (
                      <motion.div 
                        className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <div className="flex items-center text-red-400">
                          <span className="mr-2">❌</span>
                          <span className="font-medium">{createError}</span>
                        </div>
                      </motion.div>
                    )}
                    {createSuccess && (
                      <motion.div 
                        className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <div className="flex items-center text-green-400">
                          <span className="mr-2">✅</span>
                          <span className="font-medium">{createSuccess}</span>
                        </div>
                      </motion.div>
                    )}
                    {mintAddress && (
                      <motion.div 
                        className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <div className="text-white">
                          <div className="flex items-center mb-2">
                            <span className="mr-2">🎉</span>
                            <span className="font-semibold">Token Created Successfully!</span>
                          </div>
                          <div className="text-sm text-gray-300 mb-2">Mint Address:</div>
                          <div className="font-mono text-sm bg-black/40 p-3 rounded-xl break-all">
                            <a 
                              href={`https://solscan.io/token/${mintAddress}?cluster=devnet`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-orange-400 hover:text-orange-300 transition-colors duration-200"
                            >
                              {mintAddress}
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                  
                {/* Transfer Hook Initialization */}
                  {mintAddress && (
                    <motion.div 
                    className="bg-blue-500/10 p-6 border border-blue-500/30 rounded-lg"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <h3 className="text-xl font-bold text-blue-400 mb-4">Initialize Transfer Hook Account</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Before tokens can be transferred, you need to initialize the transfer hook account (ExtraAccountMetas). 
                      This is a one-time setup required for each mint with transfer hooks.
                    </p>
                          <motion.button 
                      onClick={() => handleInitializeTransferHook(mintAddress)}
                      disabled={initializingHook}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50" 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }}
                          >
                      {initializingHook ? 'Checking...' : 'Initialize Transfer Hook Account'}
                          </motion.button>
                    {hookInitError && <div className="text-red-400 font-medium mt-4">{hookInitError}</div>}
                    {hookInitSuccess && <div className="text-green-400 font-medium mt-4">{hookInitSuccess}</div>}
                </motion.div>
                  )}
                  
                {/* Transfer Tokens Section */}
                  {mintAddress && (
                    <motion.div 
                    className="bg-purple-500/10 p-6 border border-purple-500/30 rounded-lg"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                    <h3 className="text-xl font-bold text-purple-400 mb-4">Transfer Tokens with Transfer Hook</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Test your transfer hook by sending tokens. The hook will be executed during the transfer.
                    </p>
                    <form onSubmit={handleTransferWithHook} className="grid md:grid-cols-2 gap-6">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Address</label>
                          <input 
                            type="text" 
                            value={recipientAddress} 
                            onChange={e => setRecipientAddress(e.target.value)} 
                            required 
                            className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400" 
                            placeholder="Recipient wallet address" 
                          />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Transfer Amount</label>
                          <input 
                            type="number" 
                            value={transferAmount} 
                            onChange={e => setTransferAmount(e.target.value)} 
                            required 
                            className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400" 
                            placeholder="100" 
                          />
                        </motion.div>
                        <div className="md:col-span-2">
                          <motion.button 
                            type="submit" 
                          disabled={transferring}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-4 px-6 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50" 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }}
                          >
                          {transferring ? 'Transferring...' : 'Transfer with Hook'}
                          </motion.button>
                        </div>
                      </form>
                      {transferError && <div className="text-red-400 font-medium mt-4">{transferError}</div>}
                      {transferSuccess && <div className="text-green-400 font-medium mt-4">{transferSuccess}</div>}
                      <div className="mt-4 p-3 bg-purple-500/10 rounded-lg">
                        <p className="text-sm text-purple-300">
                        <strong>Transfer Hook Test:</strong> This will use createTransferCheckedWithTransferHookInstruction to execute your deployed transfer hook program during the transfer.
                        </p>
                      </div>
                    </motion.div>
                  )}
                
                <motion.div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}>
                  <h4 className="font-semibold mb-2 text-orange-400">Transfer Hook Configuration</h4>
                  <p className="text-sm text-gray-300">This token will be created with a transfer hook that validates transfers and allows AMM trading.</p>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'create-pool' && (
              <motion.div
                key="create-pool"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-white">Create Liquidity Pool</h2>
                
                {/* AMM Initialization Section */}
                <motion.div 
                  className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <h4 className="font-semibold mb-2 text-blue-400">AMM Initialization</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    Before creating a pool, the AMM must be initialized for this token pair. This will happen automatically when you create a pool.
                  </p>
                  {ammError && <div className="text-red-400 font-medium mb-2">{ammError}</div>}
                  {ammSuccess && <div className="text-green-400 font-medium mb-2 whitespace-pre-line">{ammSuccess}</div>}
                </motion.div>

                <form onSubmit={handleCreatePool} className="space-y-6">
                  {/* Pool Status Indicator */}
                  {(tokenAMint || mintAddress) && tokenBMint && (
                    <motion.div 
                      className={`p-3 rounded-lg border ${
                        checkingPool ? 'bg-gray-500/10 border-gray-500/30' :
                        poolExists === true ? 'bg-red-500/10 border-red-500/30' :
                        poolExists === false ? 'bg-green-500/10 border-green-500/30' :
                        'bg-gray-500/10 border-gray-500/30'
                      }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-sm">
                        {checkingPool ? (
                          <span className="text-gray-300">🔍 Checking if pool exists...</span>
                        ) : poolExists === true ? (
                          <span className="text-red-300">⚠️ Pool already exists for this token pair</span>
                        ) : poolExists === false ? (
                          <span className="text-green-300">✅ Pool does not exist - ready to create</span>
                        ) : null}
                      </div>
                    </motion.div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0 }}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token A Mint</label>
                        <input 
                          type="text" 
                        value={tokenAMint || mintAddress || ''}
                          onChange={e => setTokenAMint(e.target.value)} 
                          required 
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400" 
                        placeholder={mintAddress || "Token A mint address"}
                      />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token B Mint</label>
                        <input 
                          type="text" 
                          value={tokenBMint} 
                        onChange={e => {
                          setTokenBMint(e.target.value);
                          // Check pool existence when both tokens are set
                          const effectiveTokenA = tokenAMint || mintAddress;
                          if (effectiveTokenA && e.target.value) {
                            checkPoolExists(effectiveTokenA, e.target.value);
                          }
                        }}
                          required 
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400" 
                          placeholder="Token B mint address" 
                        />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token A Amount</label>
                      <input 
                        type="number" 
                        value={tokenAAmount} 
                        onChange={e => setTokenAAmount(e.target.value)} 
                        required 
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400" 
                        placeholder="1000000" 
                      />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token B Amount</label>
                      <input 
                        type="number" 
                        value={tokenBAmount} 
                        onChange={e => setTokenBAmount(e.target.value)} 
                        required 
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-400" 
                        placeholder="1000000" 
                      />
                    </motion.div>
                    </div>
                  <motion.div 
                    className="bg-green-500/10 p-4 rounded-lg border border-green-500/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <h4 className="font-semibold mb-2 text-green-400">Pool Configuration</h4>
                  <p className="text-sm text-gray-300">
                    This will create a constant product AMM pool with 0.25% fee and support for transfer hooks.
                  </p>
                  </motion.div>
                  <motion.button 
                    type="submit"
                    disabled={creatingPool || poolExists === true}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 px-6 rounded-lg font-medium hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {creatingPool ? 'Creating Pool...' : 
                     poolExists === true ? 'Pool Already Exists' : 
                     'Create Pool'}
                  </motion.button>
                </form>
                {poolError && (
                  <div className="text-red-400 font-medium mt-4">
                    {poolError}
                    {poolError.includes('Pool already exists') && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('trade')}
                          className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1 rounded transition-colors"
                        >
                          → Go to Trade Tab
                        </button>
                    </div>
                    )}
                  </div>
                )}
                {poolSuccess && <div className="text-green-400 font-medium mt-4 whitespace-pre-line">{poolSuccess}</div>}
              </motion.div>
            )}

            {activeTab === 'trade' && (
              <motion.div
                key="trade"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Header Section */}
                  <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mr-4">
                      📈
                    </div>
                    <div className="text-left">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Trade Tokens
                      </h2>
                      <p className="text-gray-400">Instant Token Swaps</p>
                    </div>
                  </div>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                    Swap tokens instantly with our advanced AMM supporting Token-2022 and Transfer Hooks.
                  </p>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Main Swap Interface */}
                        <motion.div
                    className="lg:col-span-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold text-white flex items-center">
                        <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-lg mr-3">
                          🔄
                        </span>
                        Swap
                      </h3>
                      {walletConnected && (
                        <motion.button
                          onClick={fetchWalletTokens}
                          disabled={loadingTokens}
                          className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50 bg-white/5 px-3 py-2 rounded-xl transition-all duration-300"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <motion.span
                            animate={{ rotate: loadingTokens ? 360 : 0 }}
                            transition={{ duration: 1, repeat: loadingTokens ? Infinity : 0, ease: "linear" }}
                          >
                            🔄
                          </motion.span>
                          <span>Refresh</span>
                        </motion.button>
                      )}
                    </div>
                    {loadingTokens && (
                      <div className="text-center py-4">
                        <div className="text-gray-300">Loading wallet tokens...</div>
                      </div>
                    )}
                    
                    {!loadingTokens && walletTokens.length === 0 && walletConnected && (
                      <div className="text-center py-4">
                        <div className="text-gray-400">No tokens found in wallet. Create some tokens first!</div>
                        <button 
                          onClick={fetchWalletTokens}
                          className="mt-2 text-blue-400 hover:text-blue-300 underline"
                        >
                          Refresh Tokens
                        </button>
                      </div>
                    )}

                    {!walletConnected && (
                      <div className="text-center py-4">
                        <div className="text-gray-400">Please connect your wallet to see available tokens</div>
                      </div>
                    )}

                    {walletConnected && walletTokens.length > 0 && (
                      <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="text-sm text-yellow-300">
                          <strong>⚠️ Pool Required:</strong> Make sure a liquidity pool exists for your token pair before swapping. 
                          If no pool exists, create one in the "Create Pool" tab first.
                        </div>
                      </div>
                    )}

                    {walletTokens.length > 0 && (
                      <form onSubmit={handleSwap} className="space-y-6">
                        {/* From Token Card */}
                        <motion.div 
                          className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-white/10 rounded-2xl p-6"
                          initial={{ opacity: 0, y: 20 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ duration: 0.5, delay: 0.3 }}
                        >
                          <label className="block text-sm font-semibold text-gray-300 mb-3">
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                              From
                            </span>
                          </label>
                          <div className="space-y-3">
                            <select 
                              value={fromToken} 
                              onChange={(e) => {
                                setFromToken(e.target.value);
                                // Auto-select a different token for "to" if possible
                                const availableTokens = walletTokens.filter(token => token.mint !== e.target.value);
                                if (availableTokens.length > 0 && toToken === e.target.value) {
                                  setToToken(availableTokens[0].mint);
                                }
                                updateSwapEstimate(swapAmount);
                              }}
                              className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white appearance-none"
                            >
                              <option value="">Select token to sell</option>
                              {walletTokens.map((token) => (
                                <option key={token.mint} value={token.mint} className="bg-black text-white">
                                  {token.symbol} • {token.balance.toFixed(4)} available
                                </option>
                              ))}
                            </select>
                            
                            <div className="relative">
                            <input
                                type="number"
                                value={swapAmount}
                                onChange={(e) => {
                                  setSwapAmount(e.target.value);
                                  updateSwapEstimate(e.target.value);
                                }}
                                className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-2xl font-semibold"
                                placeholder="0.0"
                              />
                              {fromToken && (
                                <motion.button
                                  type="button"
                                  onClick={() => {
                                    const token = walletTokens.find(t => t.mint === fromToken);
                                    if (token) {
                                      setSwapAmount(token.balance.toString());
                                      updateSwapEstimate(token.balance.toString());
                                    }
                                  }}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl font-medium transition-all duration-200"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  MAX
                                </motion.button>
                              )}
                            </div>
                            
                            {fromToken && (
                              <div className="text-sm text-gray-400">
                                Balance: {walletTokens.find(t => t.mint === fromToken)?.balance.toFixed(4) || '0'} {walletTokens.find(t => t.mint === fromToken)?.symbol}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        {/* Swap Direction Button */}
                        <motion.div 
                          className="flex justify-center"
                          initial={{ opacity: 0, scale: 0.8 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          transition={{ duration: 0.5, delay: 0.4 }}
                        >
                          <motion.button
                            type="button"
                            onClick={() => {
                              // Swap the tokens
                              const temp = fromToken;
                              setFromToken(toToken);
                              setToToken(temp);
                              updateSwapEstimate(swapAmount);
                            }}
                            className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                            whileHover={{ scale: 1.1, rotate: 180 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            ↕️
                          </motion.button>
                        </motion.div>

                        {/* To Token Card */}
                        <motion.div 
                          className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-white/10 rounded-2xl p-6"
                          initial={{ opacity: 0, y: 20 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ duration: 0.5, delay: 0.5 }}
                        >
                          <label className="block text-sm font-semibold text-gray-300 mb-3">
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                              To
                            </span>
                          </label>
                          <div className="space-y-3">
                            <select 
                              value={toToken} 
                              onChange={(e) => {
                                setToToken(e.target.value);
                                updateSwapEstimate(swapAmount);
                              }}
                              className="w-full px-4 py-4 bg-black/60 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white appearance-none"
                            >
                              <option value="">Select token to buy</option>
                              {walletTokens
                                .filter(token => token.mint !== fromToken)
                                .map((token) => (
                                  <option key={token.mint} value={token.mint} className="bg-black text-white">
                                    {token.symbol} • {token.balance.toFixed(4)} balance
                                  </option>
                                ))}
                            </select>
                            
                            <div className="px-4 py-4 bg-black/40 border border-white/10 rounded-2xl">
                              <div className="text-2xl font-semibold text-gray-300">
                                {estimatedOutput || '0.0'}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                Estimated output
                              </div>
                            </div>
                            
                            {toToken && (
                              <div className="text-sm text-gray-400">
                                Balance: {walletTokens.find(t => t.mint === toToken)?.balance.toFixed(4) || '0'} {walletTokens.find(t => t.mint === toToken)?.symbol}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        {/* Pricing Info */}
                      <motion.div 
                          className="bg-black/40 border border-white/10 rounded-2xl p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.6 }}
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Rate</span>
                              <span className="text-sm text-white font-medium">
                                1 {walletTokens.find(t => t.mint === fromToken)?.symbol || 'TOKEN'} = {estimatedOutput || '0.0'} {walletTokens.find(t => t.mint === toToken)?.symbol || 'TOKEN'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Price Impact</span>
                              <span className={`text-sm font-medium ${priceImpact.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
                                {priceImpact}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Network Fee</span>
                              <span className="text-sm text-white font-medium">~0.00025 SOL</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">LP Fee</span>
                              <span className="text-sm text-white font-medium">0.25%</span>
                            </div>
                          </div>
                      </motion.div>

                        {/* Swap Button */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.7 }}
                        >
                      <motion.button 
                            type="submit"
                            disabled={swapping || !fromToken || !toToken || !swapAmount}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                            whileHover={{ scale: swapping ? 1 : 1.02 }}
                            whileTap={{ scale: swapping ? 1 : 0.98 }}
                          >
                            {swapping && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700"
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                              />
                            )}
                            <span className="relative z-10 flex items-center justify-center">
                              {swapping ? (
                                <>
                                  <motion.div
                                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  />
                                  Swapping...
                                </>
                              ) : (
                                <>
                                  <span className="mr-2">🚀</span>
                                  {!fromToken || !toToken || !swapAmount ? 'Enter Details to Swap' : 'Swap Tokens'}
                                </>
                              )}
                            </span>
                      </motion.button>
                        </motion.div>

                        {swapError && (
                          <div className="text-red-400 font-medium mt-4">
                            {swapError}
                            {(swapError.includes('No liquidity pool found') || swapError.includes('has no liquidity') || swapError.includes('insufficient liquidity') || swapError.includes('Pool calculation error')) && (
                              <div className="mt-2 space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Pre-populate create pool form with selected tokens
                                    setTokenAMint(fromToken);
                                    setTokenBMint(toToken);
                                    setActiveTab('create-pool');
                                  }}
                                  className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1 rounded transition-colors mr-2"
                                >
                                  → Create Pool for These Tokens
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    // Debug: Check pool data
                                    try {
                                      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
                                      const ammProgramId = new PublicKey(AMM_PROGRAM_ID);
                                      const tokenAMintPubkey = new PublicKey(fromToken);
                                      const tokenBMintPubkey = new PublicKey(toToken);
                                      
                                      const [ammPDA] = PublicKey.findProgramAddressSync(
                                        [Buffer.from('amm'), tokenAMintPubkey.toBuffer(), tokenBMintPubkey.toBuffer()],
                                        ammProgramId
                                      );
                                      
                                      const [poolPDA] = PublicKey.findProgramAddressSync(
                                        [Buffer.from('pool'), ammPDA.toBuffer()],
                                        ammProgramId
                                      );
                                      
                                      const poolAccount = await connection.getAccountInfo(poolPDA);
                                      console.log('Pool debug info:', {
                                        poolExists: !!poolAccount,
                                        poolAddress: poolPDA.toString(),
                                        dataLength: poolAccount?.data.length,
                                        rawData: poolAccount ? Array.from(poolAccount.data.slice(0, 32)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ') : 'No data'
                                      });
                                      alert('Pool debug info logged to console');
                                    } catch (err) {
                                      console.error('Debug error:', err);
                                    }
                                  }}
                                  className="text-xs bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-2 py-1 rounded transition-colors"
                                >
                                  🔍 Debug Pool
                                </button>
                    </div>
                            )}
                          </div>
                        )}
                        {swapSuccess && <div className="text-green-400 font-medium mt-4">{swapSuccess}</div>}
                      </form>
                    )}
                  </motion.div>

                  {/* Pool Info Sidebar */}
                  <motion.div 
                    className="space-y-6"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    {/* Pool Statistics */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                      <h3 className="text-xl font-bold mb-6 text-white flex items-center">
                        <span className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center text-lg mr-3">
                          📊
                        </span>
                        Pool Analytics
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Total Value Locked', value: '$2.4M', change: '+12.5%', icon: '💰', color: 'text-green-400' },
                          { label: 'Volume (24h)', value: '$845K', change: '+8.2%', icon: '📈', color: 'text-blue-400' },
                          { label: 'Fees Earned (24h)', value: '$2.1K', change: '+15.3%', icon: '💎', color: 'text-purple-400' },
                          { label: 'Active Pools', value: '24', change: '+3', icon: '🏊', color: 'text-orange-400' },
                      ].map((item, index) => (
                        <motion.div
                          key={item.label}
                            className="bg-black/30 border border-white/10 rounded-2xl p-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400 flex items-center">
                                <span className="mr-2">{item.icon}</span>
                                {item.label}
                              </span>
                              <span className={`text-xs font-medium ${item.color}`}>
                                {item.change}
                              </span>
                            </div>
                            <div className="text-lg font-bold text-white">{item.value}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Swaps */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                      <h3 className="text-xl font-bold mb-6 text-white flex items-center">
                        <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-lg mr-3">
                          ⚡
                        </span>
                        Recent Activity
                      </h3>
                      <div className="space-y-3">
                        {[
                          { type: 'Swap', tokens: 'SOL → USDC', amount: '10.5', time: '2m ago' },
                          { type: 'Add', tokens: 'ETH-USDT', amount: '5.2K', time: '5m ago' },
                          { type: 'Swap', tokens: 'BTC → ETH', amount: '0.25', time: '8m ago' },
                          { type: 'Remove', tokens: 'SOL-USDC', amount: '1.8K', time: '12m ago' },
                        ].map((activity, index) => (
                          <motion.div
                            key={index}
                            className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl hover:border-white/10 transition-all duration-200"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  activity.type === 'Swap' ? 'bg-blue-400' :
                                  activity.type === 'Add' ? 'bg-green-400' : 'bg-red-400'
                                }`}></span>
                                <span className="text-sm font-medium text-white">{activity.type}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">{activity.tokens}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-white">{activity.amount}</div>
                              <div className="text-xs text-gray-400">{activity.time}</div>
                            </div>
                        </motion.div>
                      ))}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                      <h3 className="text-xl font-bold mb-4 text-white">Quick Actions</h3>
                      <div className="space-y-3">
                        <motion.button
                          onClick={() => setActiveTab('create-pool')}
                          className="w-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-2xl font-medium hover:bg-gradient-to-r hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="mr-2">🏊</span>
                          Create Pool
                        </motion.button>
                        <motion.button
                          onClick={() => setActiveTab('portfolio')}
                          className="w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 py-3 px-4 rounded-2xl font-medium hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="mr-2">💼</span>
                          View Portfolio
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === 'portfolio' && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Portfolio</h2>
                  <button
                    onClick={() => {
                      fetchPortfolioData();
                      fetchWalletTokens();
                    }}
                    disabled={loadingPortfolio}
                    className="text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50"
                  >
                    {loadingPortfolio ? '⟳' : '↻'} Refresh
                  </button>
                </div>

                {!walletConnected ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Please connect your wallet to view your portfolio</div>
                  </div>
                ) : loadingPortfolio ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">Loading portfolio data...</div>
                  </div>
                                ) : (
                  <>
                    {/* Debug Info */}
                    <motion.div 
                      className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 p-4 rounded-xl border border-gray-500/20 mb-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <h4 className="text-sm font-semibold mb-2 text-gray-400">Debug Info</h4>
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-4">
                        <div>Wallet Connected: {walletConnected ? '✅' : '❌'}</div>
                        <div>Loading: {loadingPortfolio ? '⏳' : '✅'}</div>
                        <div>Total Tokens: {portfolioData.tokens.length}</div>
                        <div>Total Value: ${portfolioData.totalValue.toFixed(2)}</div>
                      </div>
                      <button
                        onClick={() => {
                          console.log('🔄 Manual portfolio refresh triggered');
                          fetchPortfolioData();
                        }}
                        className="mt-2 text-xs bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-2 py-1 rounded"
                      >
                        🔄 Force Refresh Portfolio
                      </button>
                    </motion.div>

                    {/* Portfolio Overview */}
                    <motion.div 
                      className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-xl border border-purple-500/20"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Portfolio Overview</h3>
                <div className="grid md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-white">${portfolioData.totalValue.toFixed(2)}</p>
                          <p className="text-gray-400">Total Value</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-400">{portfolioData.tokens.length}</p>
                          <p className="text-gray-400">Assets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-400">{portfolioData.pools.length}</p>
                          <p className="text-gray-400">LP Positions</p>
                        </div>
                      </div>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Token Holdings */}
                    <motion.div
                        className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      >
                        <h3 className="text-lg font-semibold mb-4 text-blue-400">Token Holdings</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {portfolioData.tokens.map((token, index) => (
                          <motion.div
                              key={token.mint}
                              className="flex justify-between items-center p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors"
                              initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{token.symbol}</span>
                                  {token.change24h !== undefined && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      token.change24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                      {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-400 text-sm">{token.balance.toFixed(4)} tokens</p>
                                <p className="text-xs text-gray-500">{token.mint === 'SOL' ? 'SOL' : `${token.mint.slice(0, 8)}...`}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-medium">${token.usdValue?.toFixed(2) || '0.00'}</p>
                                <p className="text-gray-400 text-sm">${((token.usdValue || 0) / (token.balance || 1)).toFixed(4)}/token</p>
                              </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                      {/* Recent Transactions */}
                      <motion.div 
                        className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-xl border border-orange-500/20"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        <h3 className="text-lg font-semibold mb-4 text-orange-400">Recent Activity</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {portfolioData.transactions.length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-gray-400">No recent transactions</p>
                            </div>
                          ) : (
                            portfolioData.transactions.map((tx, index) => (
                              <motion.div
                                key={tx.signature}
                                className="flex justify-between items-center p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.03 }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                    tx.type === 'swap' ? 'bg-blue-500/20 text-blue-400' :
                                    tx.type === 'create_pool' ? 'bg-green-500/20 text-green-400' :
                                    'bg-purple-500/20 text-purple-400'
                                  }`}>
                                    {tx.type === 'swap' ? '⇄' : tx.type === 'create_pool' ? '🏊' : '→'}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                                    <p className="text-gray-400 text-sm">
                                      {new Date(tx.timestamp).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-medium ${
                                    tx.details.status === 'success' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {tx.details.status}
                                  </p>
                                  <a
                                    href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-xs underline"
                                  >
                                    View
                                  </a>
                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
