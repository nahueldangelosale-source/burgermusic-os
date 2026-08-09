import os
import re

file_path = r'D:\Musica Descargada\Burger_Music_OS\HTML_Prototipos\kds_prototipo.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clear lane-new
content = re.sub(
    r'(<div class="lane-body" id="lane-new">).*?(</div>\s*<!-- CARRIL2: En Preparaci)', 
    r'\1\n                <!-- JS Renders here -->\n            \2', 
    content, 
    flags=re.DOTALL
)

# 2. Clear lane-prep
content = re.sub(
    r'(<div class="lane-body" id="lane-prep">).*?(</div>\s*<!-- CARRIL3: Listas)', 
    r'\1\n                <!-- JS Renders here -->\n            \2', 
    content, 
    flags=re.DOTALL
)

# 3. Clear lane-ready
content = re.sub(
    r'(<div class="lane-body" id="lane-ready">).*?(</div>\s*</main>)', 
    r'\1\n                <!-- JS Renders here -->\n            \2', 
    content, 
    flags=re.DOTALL
)

# Also fix the JS to make sure the startPrep function is correct
content = content.replace('function startPrep(btn)', 'function startPrep(btn)') 
# Oh wait, startPrep might not exist or the button is usually moveCard()
# In my injected JS, I wrote <button class="action-btn" onclick="startPrep(this)">
# But the original HTML had <button class="btn-advance btn-start-prep" onclick="moveCard('order-138', 'lane-new', 'lane-prep', 'count-new', 'count-prep', this)">
# Let's update the injected JS to use moveCard:
js_fixed = r"""
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
                        <div class="item-qty-badge"></div>
                        <div class="item-info">
                            <div class="item-name"></div>
                            
                        </div>
                    </div>
                ;
            });
            
            // Si el status cambia, cambiaremos el botn
            let actionBtn = <button class="btn-advance btn-start-prep" onclick="moveCard('order-', 'lane-new', 'lane-prep', 'count-new', 'count-prep', this)">EMPEZAR <i class="ri-arrow-right-line"></i></button>;
            
            return 
                <div class="order-card urgency-warn" id="order-" data-id="">
                    <div class="card-top-bar"></div>
                    <div class="order-card-header">
                        <span class="order-number">#</span>
                        <span class="order-type "></span>
                        <span class="order-timer timer-warn"><i class="ri-timer-line"></i> </span>
                    </div>
                    <div class="order-card-body">
                        
                    </div>
                    
                </div>
            ;
        }
"""
content = re.sub(r'// --- LOGICA DE INTEGRACION POS -> KDS ---.*?return \s*<div class="order-card', js_fixed + r'\n            return \n                <div class="order-card', content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
