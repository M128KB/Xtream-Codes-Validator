import re

with open('src/components/PricingModal.tsx', 'r') as f:
    content = f.read()

start_index = content.find("          {/* TAB 4: OWNER ADMIN ORDERS & KEY MANAGEMENT */}")
if start_index == -1:
    print("Start not found")
    exit(1)
    
# Find the end of the admin tab content. It ends with:
#               )}
#             </div>
#           )}
# 
#         </div>
# 
#         {/* Footer */}

end_str = "          )}\n\n        </div>\n\n        {/* Footer */}"
end_index = content.find(end_str, start_index)

if end_index == -1:
    print("End not found")
    exit(1)

new_content = content[:start_index] + content[end_index:]

with open('src/components/PricingModal.tsx', 'w') as f:
    f.write(new_content)

print("Removed admin tab content")
