import sys

def main():
    with open('src/AiProces.jsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    dashboard_code = ''.join(lines[1048:1369])
    
    imports = """import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Trash2, Plus, PenLine, Network, ChevronDown, ChevronRight, Layers, LayoutGrid, Bot, ArrowRight, Loader2 } from 'lucide-react';

"""

    with open('src/components/dashboard/Dashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(imports + dashboard_code + '\nexport default Dashboard;\n')

if __name__ == '__main__':
    main()
