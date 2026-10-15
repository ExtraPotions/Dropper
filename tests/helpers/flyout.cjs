'use strict';
// Opens a product's menu the way a person does: with several products on the page, click the shared launcher to
// open the flyout, then click the product's tile; with one product, click its launcher. Copied into each product.
const HUB='[data-exp-part="flyout-hub"]';
async function launcherBox(page,productId){
  return page.evaluate(id=>{
    const host=document.querySelector(`[data-exp-product-launcher="1"][data-product-id="${id}"]`);
    const node=host?.shadowRoot?.querySelector('[data-exp-part="launcher"],.launcher');
    if(!node)return null;const r=node.getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2,hidden:getComputedStyle(node).visibility==='hidden'};
  },productId);
}
async function hubBox(page){
  return page.evaluate(selector=>{
    const hub=[...document.querySelectorAll('[data-exp-product-launcher="1"]')].map(host=>host.shadowRoot?.querySelector(selector)).find(Boolean);
    if(!hub)return null;const r=hub.getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2,open:hub.getAttribute('aria-expanded')==='true'};
  },HUB);
}
async function frames(page,count=3){for(let i=0;i<count;i++)await page.evaluate(()=>new Promise(requestAnimationFrame));}
async function openFlyout(page){
  const hub=await hubBox(page);
  if(!hub||hub.open)return Boolean(hub);
  await page.mouse.click(hub.x,hub.y);await frames(page);
  return true;
}
async function openProduct(page,productId){
  let box=await launcherBox(page,productId);
  if(!box)throw new Error('No launcher for '+productId);
  if(box.hidden){await openFlyout(page);box=await launcherBox(page,productId);}
  await page.mouse.click(box.x,box.y);await frames(page);
}
module.exports={openProduct,openFlyout,launcherBox,hubBox};
