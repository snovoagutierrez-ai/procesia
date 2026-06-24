import re
import sys

def fix_diagrams():
    with open('src/AiProces.jsx', 'r', encoding='utf-8') as f:
        ai_content = f.read()

    # Find GatewayNode
    gn_match = re.search(r'(function\s+GatewayNode\s*\([^)]*\)\s*\{)', ai_content)
    if gn_match:
        start_idx = gn_match.start()
        body_start = gn_match.end() - 1
        
        brace_count = 0
        in_string = False
        string_char = ''
        idx = body_start
        
        while idx < len(ai_content):
            char = ai_content[idx]
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
                if char == string_char and ai_content[idx-1] != '\\':
                    in_string = False
            idx += 1
            
        gn_content = ai_content[start_idx:idx]
        
        # Remove GatewayNode from AiProces
        ai_content = ai_content[:start_idx] + ('\n' * ai_content[start_idx:idx].count('\n')) + ai_content[idx:]
        
        # Remove nodeTypes from AiProces
        ai_content = re.sub(r'const\s+nodeTypes\s*=\s*\{.*?\};', '', ai_content)
        
        with open('src/AiProces.jsx', 'w', encoding='utf-8') as f:
            f.write(ai_content)
            
        with open('src/components/diagram/FlowDiagrams.jsx', 'r', encoding='utf-8') as f:
            flow_content = f.read()
            
        # Add GatewayNode and nodeTypes
        flow_content = flow_content.replace('export { VSMLadder', gn_content + '\n\nconst nodeTypes = { startNode: StartNode, endNode: EndNode, taskNode: TaskNode, gatewayNode: GatewayNode };\n\nexport { VSMLadder')
        flow_content = flow_content.replace('export { VSMLadder, StartNode, EndNode, TaskNode, getLayoutedElements, buildFlowData, FlowDiagram };', 'export { VSMLadder, StartNode, EndNode, TaskNode, GatewayNode, getLayoutedElements, buildFlowData, FlowDiagram, nodeTypes };')
        
        with open('src/components/diagram/FlowDiagrams.jsx', 'w', encoding='utf-8') as f:
            f.write(flow_content)
            
if __name__ == '__main__':
    fix_diagrams()
