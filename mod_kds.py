import os
import re

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\kds_prototipo.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove hardcoded tickets in lane-new
start_new = content.find('<div class="lane-body" id="lane-new">')
end_new = content.find('</div>', start_new + 1)
# Need to find the exact end of lane-new. 
# We'll just replace the content between <div class="lane-body" id="lane-new"> and the next lane-header
match = re.search(r'(<div class="lane-body" id="lane-new">)(.*?)(<div class="kds-lane">)', content, flags=re.DOTALL)
if match:
    content = content[:match.start(2)] + "\n                <!-- JS Renders here -->\n            </div>\n            " + content[match.end(2):]

# 2. Remove hardcoded tickets in lane-prep
match_prep = re.search(r'(<div class="lane-body" id="lane-prep">)(.*?)(<div class="kds-lane">)', content, flags=re.DOTALL)
if match_prep:
    content = content[:match_prep.start(2)] + "\n                <!-- JS Renders here -->\n            </div>\n            " + content[match_prep.end(2):]

# 3. Remove hardcoded tickets in lane-ready
match_ready = re.search(r'(<div class="lane-body" id="lane-ready">)(.*?)(</main>)', content, flags=re.DOTALL)
if match_ready:
    content = content[:match_ready.start(2)] + "\n                <!-- JS Renders here -->\n            </div>\n        " + content[match_ready.end(2):]

# 4. Update JavaScript to render tickets from localStorage
js_script = """
        // --- LOGICA DE INTEGRACION POS -> KDS ---
        function renderOrderCard(order) {
            let modsHTML = '';
            let typeClass = 'type-salon';
            if(order.type.toLowerCase() === 'takeaway') typeClass = 'type-takeaway';
            if(order.type.toLowerCase() === 'delivery') typeClass = 'type-delivery';
            
            let itemsHTML = '';
            order.items.forEach(item => {
                let modStr = '';
                if(item.mods && item.mods.length > 0) {
                    modStr = <div class="item-mods" style="color:var(--brand-danger);"> + item.mods.join(', ') + </div>;
                }
                itemsHTML += 
                    <div class="order-item interactive">
                        <div class="item-qty-badge">\</div>
                        <div class="item-info">
                            <div class="item-name">\</div>
                            \
                        </div>
                    </div>
                ;
            });
            
            // Si el status cambia, cambiaremos el botn
            let actionBtn = <button class="action-btn" onclick="startPrep(this)">EMPEZAR <i class="ri-arrow-right-line"></i></button>;
            
            return 
                <div class="order-card urgency-warn" id="order-\" data-id="\">
                    <div class="card-top-bar"></div>
                    <div class="order-card-header">
                        <span class="order-number">#\</span>
                        <span class="order-type \">\</span>
                        <span class="order-timer timer-warn"><i class="ri-timer-line"></i> \</span>
                    </div>
                    <div class="order-card-body">
                        \
                    </div>
                    \
                </div>
            ;
        }

        function loadOrders() {
            const laneNew = document.getElementById('lane-new');
            let orders = JSON.parse(localStorage.getItem('kds_orders') || '[]');
            
            // Limpiar columna nuevas
            laneNew.innerHTML = '';
            
            // Solo renderizamos las 'nuevas' (el resto dependera del backend o ms lgica en un sistema real, ac lo simplificamos)
            orders.forEach(order => {
                // Solo si no est ya en otra columna (para no duplicar si drag&drop)
                if(!document.getElementById('order-' + order.id)) {
                    laneNew.innerHTML += renderOrderCard(order);
                }
            });
            
            // Re-bind interactive items
            document.querySelectorAll('.order-item.interactive').forEach(item => {
                item.onclick = function() {
                    this.classList.toggle('completed');
                    updateProgress(this.closest('.order-card'));
                };
            });
            
            updateCounts();
        }

        window.addEventListener('storage', (e) => {
            if(e.key === 'kds_orders') {
                loadOrders();
                new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3').play().catch(e=>console.log(e));
            }
        });

        // Modificamos el init para que cargue
        document.addEventListener('DOMContentLoaded', () => {
            loadOrders();
            setInterval(loadOrders, 2000); // Polling por si localStorage events fallan en mismas tabs
        });
"""

# Inject before </script>
content = content.replace('</script>', js_script + '\n    </script>')

# Replace the specific init function if it conflicts with hardcoded counts
content = content.replace("document.getElementById('count-new').innerText = '3';", "")
content = content.replace("document.getElementById('count-prep').innerText = '1';", "")
content = content.replace("document.getElementById('count-ready').innerText = '1';", "")

def replace_counts(m):
    return """
        function updateCounts() {
            document.getElementById('count-new').innerText = document.getElementById('lane-new').querySelectorAll('.order-card').length;
            document.getElementById('count-prep').innerText = document.getElementById('lane-prep').querySelectorAll('.order-card').length;
            document.getElementById('count-ready').innerText = document.getElementById('lane-ready').querySelectorAll('.order-card').length;
        }
    """
content = re.sub(r'function updateCounts\(\) \{.*?\}', replace_counts, content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
