function fB6(Z, G){ return{ durationMs:"DURATION", costUSD:"COST", uuid:"UUID", timestamp:Z.timestamp, message:{ ...Z.message, content:Z.message.content.map((D) = > { switch(D.type){ case"text":return{ ...D, text:G(D.text), citations:D.citations||[] };
case"tool_use":return{ ...D, input:ZK1(D.input, G) };
default:return D } }).filter(Boolean) }, type:"assistant" } }