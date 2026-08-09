import json
import os

transcript_path = r'C:\Users\nahue\.gemini\antigravity\brain\6b80ff63-c4f2-470b-a96e-3ceabad9effc\.system_generated\logs\transcript_full.jsonl'
output_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_restored.html'

found = False
try:
    with open(transcript_path, 'r', encoding='utf-8') as f:
        # Read from bottom to top to get the most recent valid version
        lines = f.readlines()
        
        for line in reversed(lines):
            try:
                data = json.loads(line)
                
                # Check tool calls / outputs
                if 'tool_calls' in data:
                    for call in data['tool_calls']:
                        if call.get('name') == 'default_api:view_file' and 'response' in call:
                            response = call['response']
                            if isinstance(response, dict) and 'output' in response:
                                out_text = response['output']
                                if 'inventario_prototipo.html' in out_text and 'Total Lines: 904' in out_text:
                                    # We found a view_file output that might have the whole file.
                                    # Wait, view_file only returns a subset of lines unless specified.
                                    # Let's see if we can find where I viewed the *entire* file or where it was initially provided.
                                    pass
                                    
                # What if the user uploaded it in the prompt?
                if data.get('type') == 'USER_INPUT' and 'inventario_prototipo.html' in data.get('content', ''):
                    # Check if the content has the actual html
                    if '<html' in data['content']:
                        # Try to extract the HTML content
                        # Assuming it's inside some code block
                        content = data['content']
                        start = content.find('<!DOCTYPE html>')
                        end = content.rfind('</html>') + 7
                        if start != -1 and end != -1:
                            html = content[start:end]
                            if len(html) > 50000:  # The file should be ~57KB
                                with open(output_path, 'w', encoding='utf-8') as out:
                                    out.write(html)
                                print("Found original file in user prompt!")
                                found = True
                                break
                                
            except json.JSONDecodeError:
                continue
                
            if found:
                break
                
except Exception as e:
    print(f"Error: {e}")

if not found:
    print("Could not find the full original file in transcript.")
