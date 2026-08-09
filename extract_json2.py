import json
import os

transcript_path = r'C:\Users\nahue\.gemini\antigravity\brain\6b80ff63-c4f2-470b-a96e-3ceabad9effc\.system_generated\logs\transcript_full.jsonl'
output_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\inventario_recovered.html'

found = False
try:
    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
        for line in reversed(lines):
            try:
                data = json.loads(line)
                
                # Check tool responses
                if data.get('type') == 'TOOL_RESPONSE' and 'tool_responses' in data:
                    for resp in data['tool_responses']:
                        if resp.get('name') == 'default_api:run_command' and 'response' in resp:
                            out_text = str(resp['response'])
                            if 'LineNumber' in out_text and 'inventario' in out_text and 'cat-congelados' in out_text:
                                print("Found matching tool response!")
                                
                                start = out_text.find('[')
                                end = out_text.rfind(']') + 1
                                
                                if start != -1 and end != -1:
                                    json_arr_str = out_text[start:end]
                                    arr = json.loads(json_arr_str)
                                    
                                    html_lines = []
                                    last_line = 0
                                    for item in arr:
                                        ln = item['LineNumber']
                                        text = item['Line']
                                        while last_line < ln - 1:
                                            html_lines.append("")
                                            last_line += 1
                                        html_lines.append(text)
                                        last_line = ln
                                        
                                    with open(output_path, 'w', encoding='utf-8') as out:
                                        out.write("\n".join(html_lines))
                                        
                                    print(f"Recovered {len(html_lines)} lines!")
                                    found = True
                                    break
            except Exception as e:
                pass
                
            if found:
                break
                
except Exception as e:
    print(f"Error: {e}")
