
import React, { useState, useMemo } from 'react';
import { BlockType, BLOCK_DEFINITIONS } from '../blocks';
import { BlockDefinition, BlockCategory } from '../types';
import { textureUrl } from '../utils/textures';

interface InventoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlock: (blockId: number) => void;
}

const CATEGORIES: BlockCategory[] = ['Nature', 'Wood', 'Plants', 'Building', 'Misc'];

const Inventory: React.FC<InventoryProps> = ({ isOpen, onClose, onSelectBlock }) => {
  const [activeTab, setActiveTab] = useState<BlockCategory | 'Search'>('Nature');
  const [searchQuery, setSearchQuery] = useState('');

  const allBlocks = useMemo(() => Object.values(BLOCK_DEFINITIONS).filter(b => b.id !== BlockType.AIR), []);

  const filteredBlocks = useMemo(() => {
    if (activeTab === 'Search') {
      const q = searchQuery.toLowerCase();
      return allBlocks.filter(b => b.name.toLowerCase().includes(q));
    }
    return allBlocks.filter(b => b.category === activeTab);
  }, [activeTab, searchQuery, allBlocks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-gray-700 w-[800px] h-[600px] rounded-lg flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Header & Tabs */}
        <div className="bg-[#2a2a2a] border-b border-gray-700 p-2 flex items-center justify-between">
            <div className="flex gap-1">
                {CATEGORIES.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                            activeTab === cat ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
                <button 
                    onClick={() => setActiveTab('Search')}
                    className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 ml-2 ${
                        activeTab === 'Search' ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    <span>🔍</span> Search
                </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white px-3">✕</button>
        </div>

        {/* Search Bar (Only visible if activeTab is Search) */}
        {activeTab === 'Search' && (
            <div className="p-3 bg-[#222]">
                <input 
                    type="text" 
                    autoFocus
                    placeholder="Search blocks..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-black/50 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                />
            </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="grid grid-cols-9 gap-2">
                {filteredBlocks.map(block => (
                    <BlockItem 
                        key={block.id} 
                        block={block} 
                        onClick={() => {
                            onSelectBlock(block.id);
                            // Optional: Don't close inventory on click, standard creative mode behavior
                        }} 
                    />
                ))}
                {filteredBlocks.length === 0 && (
                    <div className="col-span-9 text-center text-gray-500 py-10">
                        No items found.
                    </div>
                )}
            </div>
        </div>
        
        {/* Footer Info */}
        <div className="bg-[#111] p-2 text-xs text-gray-500 text-center border-t border-gray-800">
             Left Click to select • Press 'E' or 'Esc' to close
        </div>
      </div>
    </div>
  );
};

const BlockItem: React.FC<{ block: BlockDefinition; onClick: () => void }> = ({ block, onClick }) => {
    const textureIndex = block.textures.side; // Use side texture for icon
    
    return (
        <button 
            onClick={onClick}
            className="group relative w-16 h-16 bg-[#333] hover:bg-[#444] border border-gray-700 hover:border-white rounded flex items-center justify-center transition-all"
            title={block.name}
        >
            {/* 
                CSS Sprite Logic:
                background-size: 6400% means the image is 64 times wider than the container.
                Since container is 100% width of itself, image is 6400% width.
                One tile is 1/64th of image.
                Offset per index is -100% * index.
             */}
            <div 
                className="w-10 h-10 image-pixelated"
                style={{
                    backgroundImage: `url(${textureUrl})`,
                    backgroundSize: '6400% 100%',
                    backgroundPosition: `calc(-${textureIndex} * 100%) 0`
                }}
            />
            <div className="absolute bottom-1 right-1 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100">
                {block.id}
            </div>
            {/* Label on hover */}
            <div className="absolute -bottom-8 z-20 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {block.name}
            </div>
        </button>
    );
};

export default Inventory;
