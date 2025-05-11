function xB6(){ if(!X7())return{ status:"allowed" };
try{ let Z = await Qw({ maxRetries:0, model:bA, isNonInteractiveSession:!1 }), G = [{ role:"user", content:"quota" }], D = await vA(), W = await Z.beta.messages.create({ model:bA, max_tokens:1, messages:G, ...D.length > 0?{ betas:D }:{ } }).asResponse(), Y = bK.status;
if(bK.status = W.headers.get("anthropic - ratelimit - unified - status")||"allowed", bK.resetsAt = Number(W.headers.get("anthropic - ratelimit - unified - reset")), Y! = = bK.status)yB6(bK);
return bK }catch(Z){ try{ if(Z instanceof r5&&Z.status = = = 429){ let G = bK.status;
if(bK.status = "rejected", bK.resetsAt = Number(Z.headers["anthropic - ratelimit - unified - reset"]), G! = = "rejected")yB6(bK) } }catch(G){ d1(G) }return bK } }