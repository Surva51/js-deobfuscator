function ZK1(Z, G){ return r$1(Z, (D, W) = > { if(Array.isArray(D))return D.map((Y) = > ZK1(Y, G));
if(c$1(D))return ZK1(D, G);
return G(D, W, Z) }) }