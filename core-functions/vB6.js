function vB6(){ let[Z, G] = eF1.useState(bK);
return eF1.useEffect(() = > { let D = (W) = > G(W);
return Br1.add(D), () = > { Br1.delete(D) } }, []), Z }