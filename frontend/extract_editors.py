import sys
import re

def extract_editors():
    with open('src/AiProces.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the bounds of the functions
    # Using regex to find the start and a simple brace counter to find the end
    functions_to_extract = ['ValueClassWizard', 'Editor', 'GatewayEditor', 'Optimization', 'fmtShort', 'fmtLong']
    
    extracted_code = []
    
    for func_name in functions_to_extract:
        # Find start index
        match = re.search(r'function ' + func_name + r'\s*\(', content)
        if not match:
            continue
            
        start_idx = match.start()
        
        # Find end index by counting braces
        brace_count = 0
        in_string = False
        string_char = ''
        idx = start_idx
        
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
        
        # Replace the function in the original content with empty string
        content = content[:start_idx] + ('\n' * content[start_idx:idx].count('\n')) + content[idx:]

    # Now we write the extracted components to Editors.jsx
    imports = """import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Copy, Trash2, Check, ChevronRight, Sparkles, Loader2, ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';

"""
    
    exports = "\nexport { " + ", ".join(functions_to_extract) + " };\n"
    
    with open('src/components/editor/Editors.jsx', 'w', encoding='utf-8') as f:
        f.write(imports + '\n\n'.join(extracted_code) + exports)
        
    # Write back the modified AiProces.jsx
    # Add import to the top
    import_statement = 'import { Editor, GatewayEditor, Optimization, ValueClassWizard, fmtShort, fmtLong } from "./components/editor/Editors.jsx";\n'
    
    # Insert after imports
    match = re.search(r'import\s+.*?;', content)
    if match:
        # find the last import
        last_import = list(re.finditer(r'import\s+.*?;', content))[-1]
        insert_idx = last_import.end()
        content = content[:insert_idx] + '\n' + import_statement + content[insert_idx:]
    else:
        content = import_statement + content
        
    with open('src/AiProces.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    extract_editors()
