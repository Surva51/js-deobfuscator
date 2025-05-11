function oa5(Z, G){ return Z.map((D) = > { if(typeof D = = = "string")return G(D);
return D.map((W) = > { switch(W.type){ case"tool_result":if(typeof W.content = = = "string")return{ ...W, content:G(W.content) };
if(Array.isArray(W.content))return{ ...W, content:W.content.map((Y) = > { switch(Y.type){ case"text":return{ ...Y, text:G(Y.text) };
case"image":return Y;
default:return } }) };
return W;
case"text":return{ ...W, text:G(W.text) };
case"tool_use":return{ ...W, input:ZK1(W.input, G) };
case"image":return W;
default:return } }) }) }