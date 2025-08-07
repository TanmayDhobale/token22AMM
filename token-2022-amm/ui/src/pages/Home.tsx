import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Token-2022 AMM with Transfer Hooks
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          The first AMM that supports trading Token-2022 tokens with programmable transfer logic
        </p>
        <div className="flex justify-center space-x-4">
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            Create Token
          </button>
          <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
            Start Trading
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">🎯 Problem Solved</h3>
          <p className="text-gray-600">
            No major AMMs currently support Token-2022 with Transfer Hooks, limiting adoption for:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• Real-World Assets (RWA) with compliance</li>
            <li>• Enterprise tokens with KYC/AML</li>
            <li>• Programmable tokens with custom logic</li>
            <li>• Regulated tokens requiring approvals</li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">🚀 Our Solution</h3>
          <p className="text-gray-600">
            Complete AMM that makes Token-2022 with Transfer Hooks tradable:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• Custom AMM with transfer hook validation</li>
            <li>• Transfer hook program implementation</li>
            <li>• Modern web interface</li>
            <li>• Real-time trading and analytics</li>
          </ul>
        </div>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 text-xl">🔗</span>
            </div>
            <h4 className="font-semibold mb-2">Transfer Hook Support</h4>
            <p className="text-gray-600 text-sm">
              Full integration with Token-2022 transfer hooks for programmable transfers
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-xl">💰</span>
            </div>
            <h4 className="font-semibold mb-2">Liquidity Pools</h4>
            <p className="text-gray-600 text-sm">
              Create and manage liquidity pools with automatic fee collection
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
            <h4 className="font-semibold mb-2">Real-time Trading</h4>
            <p className="text-gray-600 text-sm">
              Swap tokens with slippage protection and real-time price updates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
