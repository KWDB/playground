## Install KWDB

RUN `cd /kaiwudb/bin`{{exec}}

启动 KWDB：

RUN `./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=/var/lib/kaiwudb --background`{{exec}}

RUN `./kwbase sql --host=127.0.0.1 --insecure`{{exec}}

RUN `./kwbase node status --insecure --host=127.0.0.1`{{exec}}
