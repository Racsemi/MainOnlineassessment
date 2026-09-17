import React, { useState } from 'react';
import { Calculator as CalcIcon, X } from 'lucide-react';

const CalculatorWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNum = (num: string) => {
    setDisplay(display === '0' ? num : display + num);
  };

  const handleOp = (op: string) => {
    if (display === 'Error') setDisplay('0');
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      // safe eval-like calculation
      const fullEq = equation + display;
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + fullEq.replace(/[^-()\d/*+.]/g, ''))();
      setDisplay(String(Number(result.toPrecision(10))));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-colors z-50 flex items-center justify-center"
        title="Open Calculator"
      >
        <CalcIcon size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 w-64 overflow-hidden flex flex-col">
      <div className="bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center text-white space-x-2">
          <CalcIcon size={16} />
          <span className="text-sm font-bold">Calculator</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>
      
      <div className="p-4 bg-gray-900">
        <div className="bg-gray-800 p-2 rounded-lg mb-4 text-right overflow-hidden flex flex-col items-end">
          <div className="text-gray-400 text-xs h-4 mb-1 tracking-wider">{equation}</div>
          <div className="text-white text-2xl font-mono font-bold tracking-wider overflow-hidden max-w-full truncate">{display}</div>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          <button onClick={clear} className="col-span-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 py-2 rounded font-bold transition-colors">C</button>
          <button onClick={() => handleOp('/')} className="bg-primary/20 text-blue-400 hover:bg-primary/30 py-2 rounded font-bold transition-colors">÷</button>
          
          <button onClick={() => handleNum('7')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">7</button>
          <button onClick={() => handleNum('8')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">8</button>
          <button onClick={() => handleNum('9')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">9</button>
          <button onClick={() => handleOp('*')} className="bg-primary/20 text-blue-400 hover:bg-primary/30 py-2 rounded font-bold transition-colors">×</button>
          
          <button onClick={() => handleNum('4')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">4</button>
          <button onClick={() => handleNum('5')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">5</button>
          <button onClick={() => handleNum('6')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">6</button>
          <button onClick={() => handleOp('-')} className="bg-primary/20 text-blue-400 hover:bg-primary/30 py-2 rounded font-bold transition-colors">−</button>
          
          <button onClick={() => handleNum('1')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">1</button>
          <button onClick={() => handleNum('2')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">2</button>
          <button onClick={() => handleNum('3')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">3</button>
          <button onClick={() => handleOp('+')} className="bg-primary/20 text-blue-400 hover:bg-primary/30 py-2 rounded font-bold transition-colors">+</button>
          
          <button onClick={() => handleNum('0')} className="col-span-2 bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">0</button>
          <button onClick={() => handleNum('.')} className="bg-gray-800 text-white hover:bg-gray-700 py-2 rounded font-bold transition-colors">.</button>
          <button onClick={calculate} className="bg-primary hover:bg-blue-600 text-white py-2 rounded font-bold transition-colors">=</button>
        </div>
      </div>
    </div>
  );
};

export default CalculatorWidget;
