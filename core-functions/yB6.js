function yB6(Z){ Br1.forEach((D) = > D(Z));
let G = Math.round((Z.resetsAt?Z.resetsAt - Date.now() / 1000:0) / 3600);
g1("tengu_claudeai_limits_status_changed", { status:Z.status, hoursTillReset:G }) }