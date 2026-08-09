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
                
                # Check tool calls / outputs
                if 'tool_calls' in data:
                    for call in data['tool_calls']:
                        if call.get('name') == 'default_api:run_command' and 'response' in call:
                            response = call['response']
                            if isinstance(response, dict) and 'output' in response:
                                out_text = response['output']
                                if '3336 lines' not in out_text:
                                    pass
                                # Actually the Select-String output might be in the log file, not transcript, because it was truncated!
                                # "<truncated 3336 lines>" was in the output!
                                
            except json.JSONDecodeError:
                continue
                
except Exception as e:
    print(f"Error: {e}")
