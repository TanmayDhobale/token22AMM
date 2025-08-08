"use client";

import { motion } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', name: 'Overview', icon: '📖' },
    { id: 'architecture', name: 'Architecture', icon: '🏗️' },
    { id: 'api', name: 'API Reference', icon: '🔧' },
    { id: 'examples', name: 'Examples', icon: '💡' },
    { id: 'deployment', name: 'Deployment', icon: '🚀' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'whitelist-proof', name: 'Whitelist Proof', icon: '✅' },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <motion.header 
        className="bg-black/20 backdrop-blur-md border-b border-white/10"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                Token-2022 AMM
              </h1>
            </Link>
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-gray-300 hover:text-white transition-colors duration-300"
              >
                ← Back to App
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.div 
            className="lg:col-span-1"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <nav className="sticky top-8 space-y-2">
              {sections.map((section, index) => (
                <motion.button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    activeSection === section.id
                      ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.name}
                </motion.button>
              ))}
            </nav>
          </motion.div>

          {/* Main Content */}
          <motion.div 
            className="lg:col-span-3"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-8">
              {activeSection === 'overview' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <div>
                    <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                      Token-2022 AMM Documentation
                    </h1>
                    <p className="text-gray-300 text-lg mb-6">
                      A comprehensive guide to building and using the Token-2022 AMM with Transfer Hook support.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02, y: -5 }}
                    >
                      <h3 className="text-xl font-semibold mb-4 text-blue-400">🎯 Problem Statement</h3>
                      <p className="text-gray-300 mb-4">
                        Token-2022 introduces powerful features like transfer hooks, but major AMMs don&apos;t support them:
                      </p>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• No support for programmable transfers</li>
                        <li>• Limited RWA tokenization</li>
                        <li>• Missing enterprise compliance features</li>
                        <li>• Restricted DeFi adoption</li>
                      </ul>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02, y: -5 }}
                    >
                      <h3 className="text-xl font-semibold mb-4 text-green-400">🚀 Our Solution</h3>
                      <p className="text-gray-300 mb-4">
                        Complete AMM ecosystem for Token-2022 with transfer hooks:
                      </p>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• Custom AMM with hook validation</li>
                        <li>• Transfer hook program</li>
                        <li>• Modern web interface</li>
                        <li>• Real-time trading</li>
                      </ul>
                    </motion.div>
                  </div>

                  <motion.div 
                    className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                    whileHover={{ scale: 1.01 }}
                  >
                    <h3 className="text-xl font-semibold mb-4 text-purple-400">✨ Key Features</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { icon: '🔗', title: 'Transfer Hooks', desc: 'Full Token-2022 transfer hook support' },
                        { icon: '💰', title: 'Liquidity Pools', desc: 'Automated market making with fees' },
                        { icon: '📊', title: 'Real-time Trading', desc: 'Live price updates and swaps' },
                        { icon: '🔒', title: 'Security', desc: 'Audited smart contracts' },
                        { icon: '⚡', title: 'Performance', desc: 'Optimized for speed and efficiency' },
                        { icon: '🌐', title: 'Web3 Native', desc: 'Built for decentralized future' },
                      ].map((feature, index) => (
                        <motion.div 
                          key={feature.title}
                          className="text-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                          <div className="text-2xl mb-2">{feature.icon}</div>
                          <h4 className="font-semibold mb-1 text-white">{feature.title}</h4>
                          <p className="text-gray-300 text-xs">{feature.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeSection === 'whitelist-proof' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold text-white">Transfer Hook Integration & Whitelist System</h2>
                  
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20">
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">🏗️ Architecture Overview</h3>
                      <ul className="space-y-2 text-gray-300 text-sm">
                        <li>• <strong>Whitelist PDA:</strong> Each AMM maintains approved transfer hook programs</li>
                        <li>• <strong>Hook Enforcement:</strong> Validates hook program IDs during swaps</li>
                        <li>• <strong>Remaining Accounts:</strong> ExtraAccountMetaList PDAs enable hook execution</li>
                        <li>• <strong>Program IDs:</strong> AMM <code className="bg-black/20 px-1 rounded">BkcRnA4QMEiM4mPZK4rhpHofibY87yrwaQuSE2tcwScN</code></li>
                        <li>• <strong>Hook Program:</strong> <code className="bg-black/20 px-1 rounded">GfXgLTyDbBP3LJL5XZtnBPgQm1NuQ7xNCf4wNLYHSt1U</code></li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20">
                      <h3 className="text-lg font-semibold mb-4 text-green-400">⚡ Implementation Flow</h3>
                      <ol className="space-y-2 text-gray-300 text-sm list-decimal list-inside">
                        <li>AMM extracts transfer hook program ID from Token-2022 mint extensions</li>
                        <li>Validates the hook program is in the AMM&apos;s whitelist</li>
                        <li>Constructs manual <code className="bg-black/20 px-1 rounded">spl_token_2022::instruction::transfer_checked</code></li>
                        <li>Token-2022 program resolves ExtraAccountMetaList and invokes hook</li>
                        <li>Hook program executes custom logic (e.g., rejects odd amounts in our demo)</li>
                      </ol>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20">
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">🎮 One-Click Setup Tools</h3>
                      <p className="text-gray-300 mb-4">Available in the Trade tab for easy testing:</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-sm">
                          <div className="bg-white/5 p-3 rounded-lg">
                            <strong className="text-blue-400">Init Whitelist:</strong> Creates whitelist PDA
                          </div>
                          <div className="bg-white/5 p-3 rounded-lg">
                            <strong className="text-green-400">Add Hook:</strong> Adds program to whitelist
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="bg-white/5 p-3 rounded-lg">
                            <strong className="text-orange-400">Init EAML:</strong> Initializes metadata lists
                          </div>
                          <div className="bg-white/5 p-3 rounded-lg">
                            <strong className="text-purple-400">Test Scenarios:</strong> Generate proof TXs
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-xl border border-orange-500/20">
                      <h3 className="text-lg font-semibold mb-4 text-orange-400">🔗 On-Chain Proof Transactions</h3>
                      <p className="text-gray-300 mb-4">
                        Use the scenario buttons in the Trade tab to generate real devnet transactions that demonstrate hook enforcement:
                      </p>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-3">
                          <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                          <span className="text-gray-300"><strong>Allowed Swap:</strong> Whitelisted program + even amount → Hook approves</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                          <span className="text-gray-300"><strong>Rejected by Hook:</strong> Whitelisted program + odd amount → Hook rejects</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                          <span className="text-gray-300"><strong>Not Whitelisted:</strong> Hook program removed from whitelist → AMM rejects</span>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-black/20 rounded-lg">
                        <p className="text-xs text-gray-400">
                          💡 <strong>Explorer Tips:</strong> In allowed cases, look for inner instructions to the hook program. 
                          In rejected cases, check transaction logs for <code>TransferNotAllowed</code> or <code>HookNotWhitelisted</code> errors.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'architecture' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-bold mb-6 text-white">🏗️ System Architecture</h2>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">Smart Contracts</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Token-2022 AMM Program</span>
                          <span className="text-white">Core AMM logic</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Transfer Hook Program</span>
                          <span className="text-white">Hook validation</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">SPL Token-2022</span>
                          <span className="text-white">Token standard</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Frontend Stack</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Next.js 14</span>
                          <span className="text-white">React framework</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Framer Motion</span>
                          <span className="text-white">Animations</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Tailwind CSS</span>
                          <span className="text-white">Styling</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <motion.div 
                    className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                    whileHover={{ scale: 1.01 }}
                  >
                    <h3 className="text-lg font-semibold mb-4 text-purple-400">Data Flow</h3>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">1</div>
                        <span className="text-gray-300">User connects wallet (Phantom, Solflare, etc.)</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">2</div>
                        <span className="text-gray-300">Frontend calls AMM program with transfer hook validation</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">3</div>
                        <span className="text-gray-300">Transfer hook program validates the transaction</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400">4</div>
                        <span className="text-gray-300">Transaction executes on Solana blockchain</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeSection === 'api' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-bold mb-6 text-white">🔧 API Reference</h2>
                  
                  <div className="space-y-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">AMM Program Instructions</h3>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">initialize_amm</h4>
                          <p className="text-gray-300 text-sm mb-2">Initialize the AMM with default parameters</p>
                          <code className="text-orange-400 text-xs">anchor invoke initialize_amm --program-id [PROGRAM_ID]</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">create_pool</h4>
                          <p className="text-gray-300 text-sm mb-2">Create a new liquidity pool for two tokens</p>
                          <code className="text-orange-400 text-xs">anchor invoke create_pool --program-id [PROGRAM_ID] --token-a [MINT_A] --token-b [MINT_B]</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">swap</h4>
                          <p className="text-gray-300 text-sm mb-2">Swap tokens with transfer hook validation</p>
                          <code className="text-orange-400 text-xs">anchor invoke swap --program-id [PROGRAM_ID] --amount-in [AMOUNT] --min-amount-out [MIN_AMOUNT]</code>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Transfer Hook Program</h3>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">initialize_transfer_hook</h4>
                          <p className="text-gray-300 text-sm mb-2">Initialize transfer hook for a token mint</p>
                          <code className="text-orange-400 text-xs">anchor invoke initialize_transfer_hook --program-id [HOOK_PROGRAM_ID] --mint [MINT_ADDRESS]</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">execute</h4>
                          <p className="text-gray-300 text-sm mb-2">Execute transfer hook logic during token transfer</p>
                          <code className="text-orange-400 text-xs">{`// Called automatically during token transfers`}</code>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Frontend SDK</h3>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">connectWallet()</h4>
                          <p className="text-gray-300 text-sm mb-2">Connect to supported wallets (Phantom, Solflare)</p>
                          <code className="text-orange-400 text-xs">const wallet = await connectWallet();</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">createToken()</h4>
                          <p className="text-gray-300 text-sm mb-2">Create Token-2022 with transfer hook</p>
                          <code className="text-orange-400 text-xs">const token = await createToken(name, symbol, decimals, supply);</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">swapTokens()</h4>
                          <p className="text-gray-300 text-sm mb-2">Swap tokens with slippage protection</p>
                          <code className="text-orange-400 text-xs">const tx = await swapTokens(tokenIn, tokenOut, amount, slippage);</code>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'examples' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-bold mb-6 text-white">💡 Code Examples</h2>
                  
                  <div className="space-y-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">Creating a Token with Transfer Hook</h3>
                      <div className="bg-black/30 p-4 rounded-lg">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
{`// 1. Create Token-2022 mint
const mint = await createMint(
  connection,
  payer,
  mintAuthority,
  freezeAuthority,
  decimals
);

// 2. Initialize transfer hook
const transferHook = await initializeTransferHook(
  mint,
  hookProgramId
);

// 3. Create token account
const tokenAccount = await createAccount(
  connection,
  payer,
  mint,
  owner
);`}
                        </pre>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Creating a Liquidity Pool</h3>
                      <div className="bg-black/30 p-4 rounded-lg">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
{`// 1. Initialize AMM
const amm = await initializeAmm(
  connection,
  payer,
  ammProgramId
);

// 2. Create pool
const pool = await createPool(
  connection,
  payer,
  amm,
  tokenA,
  tokenB,
  amountA,
  amountB
);

// 3. Add liquidity
const lpTokens = await addLiquidity(
  connection,
  payer,
  pool,
  amountA,
  amountB
);`}
                        </pre>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Performing a Swap</h3>
                      <div className="bg-black/30 p-4 rounded-lg">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
{`// 1. Calculate swap amount
const amountIn = new BN(1000000); // 1 token
const minAmountOut = new BN(950000); // 5% slippage

// 2. Execute swap with transfer hook
const swapTx = await swap(
  connection,
  payer,
  pool,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  transferHook // Include hook validation
);

// 3. Confirm transaction
const signature = await connection.sendTransaction(swapTx);
await connection.confirmTransaction(signature);`}
                        </pre>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'deployment' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-bold mb-6 text-white">🚀 Deployment Guide</h2>
                  
                  <div className="space-y-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">Prerequisites</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">Node.js 18+ installed</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">Rust and Cargo installed</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">Anchor CLI installed</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">Solana CLI installed</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Build and Deploy</h3>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">1. Build Programs</h4>
                          <code className="text-orange-400 text-xs">anchor build</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">2. Deploy to Devnet</h4>
                          <code className="text-orange-400 text-xs">anchor deploy --provider.cluster devnet</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">3. Update Program IDs</h4>
                          <code className="text-orange-400 text-xs"># Update Anchor.toml with deployed program IDs</code>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Frontend Deployment</h3>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">1. Build Frontend</h4>
                          <code className="text-orange-400 text-xs">cd ui && npm run build</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">2. Deploy to Vercel</h4>
                          <code className="text-orange-400 text-xs">vercel --prod</code>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">3. Configure Environment</h4>
                          <code className="text-orange-400 text-xs"># Set NEXT_PUBLIC_RPC_URL and program IDs</code>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'security' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <h2 className="text-2xl font-bold mb-6 text-white">🔒 Security Considerations</h2>
                  
                  <div className="space-y-6">
                    <motion.div 
                      className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-blue-400">Smart Contract Security</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Reentrancy Protection</span>
                            <p className="text-gray-300">All external calls are made at the end of functions</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Input Validation</span>
                            <p className="text-gray-300">All user inputs are validated and sanitized</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Access Control</span>
                            <p className="text-gray-300">Proper authority checks for privileged operations</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Transfer Hook Security</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Hook Validation</span>
                            <p className="text-gray-300">All transfer hooks are validated before execution</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Whitelist System</span>
                            <p className="text-gray-300">Only approved hook programs can be used</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Gas Optimization</span>
                            <p className="text-gray-300">Hooks are optimized to minimize gas costs</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 p-6 rounded-xl border border-purple-500/20"
                      whileHover={{ scale: 1.02 }}
                    >
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Frontend Security</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Wallet Integration</span>
                            <p className="text-gray-300">Secure wallet connection with proper error handling</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Transaction Signing</span>
                            <p className="text-gray-300">All transactions require explicit user approval</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">✓</span>
                          <div>
                            <span className="text-white font-medium">Input Sanitization</span>
                            <p className="text-gray-300">All user inputs are sanitized to prevent XSS</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
