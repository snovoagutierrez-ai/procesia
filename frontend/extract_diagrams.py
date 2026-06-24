import sys
import re

def extract_diagrams():
    with open('src/AiProces.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    functions_to_extract = ['VSMLadder', 'StartNode', 'EndNode', 'TaskNode', 'getLayoutedElements', 'buildFlowData', 'FlowDiagram']
    extracted_code = []
    
    for func_name in functions_to_extract:
        # Match function definition until the main block brace
        pattern = r'(function\s+' + func_name + r'\s*\([^)]*\)\s*\{)'
        match = re.search(pattern, content)
        
        if not match:
            print(f"Not found: {func_name}")
            continue
            
        start_idx = match.start()
        body_start = match.end() - 1
        
        brace_count = 0
        in_string = False
        string_char = ''
        idx = body_start
        
        while idx < len(content):
            char = content[idx]
            if not in_string:
                if char in ("'", '"', "`"):
                    in_string = True
                    string_char = char
                elif char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        idx += 1
                        break
            else:
                if char == string_char and content[idx-1] != '\\':
                    in_string = False
            idx += 1
            
        func_content = content[start_idx:idx]
        extracted_code.append(func_content)
        
        content = content[:start_idx] + ('\n' * content[start_idx:idx].count('\n')) + content[idx:]

    imports = """import React, { useMemo, useCallback } from 'react';
import { Handle, Position, ReactFlow, Controls, MiniMap, Background, useNodesState, useEdgesState, MarkerType, addEdge } from '@xyflow/react';
import dagre from 'dagre';
import { User, PenLine, Wrench, Clock, RotateCcw } from 'lucide-react';
import { fmtShort } from '../editor/Editors.jsx';

"""
    exports = "\nexport { " + ", ".join(functions_to_extract) + " };\n"
    
    with open('src/components/diagram/FlowDiagrams.jsx', 'w', encoding='utf-8') as f:
        f.write(imports + '\n\n'.join(extracted_code) + exports)
        
    import_statement = 'import { VSMLadder, FlowDiagram } from "./components/diagram/FlowDiagrams.jsx";\n'
    
    match = re.search(r'import\s+.*?;', content)
    if match:
        last_import = list(re.finditer(r'import\s+.*?;', content))[-1]
        insert_idx = last_import.end()
        content = content[:insert_idx] + '\n' + import_statement + content[insert_idx:]
    else:
        content = import_statement + content
        
    with open('src/AiProces.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == '__main__':
    extract_diagrams()
