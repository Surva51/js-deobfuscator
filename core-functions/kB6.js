function kB6(Z){ let G = Z.length - 1;
while(G > = 0){ let D = Z[G];
if(D?.type = = = "assistant"&&"usage"in D.message){ let{ usage:W } = D.message;
return(W.cache_creation_input_tokens??0) + (W.cache_read_input_tokens??0) }G - - }return 0 }