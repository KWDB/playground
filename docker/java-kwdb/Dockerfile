FROM kwdb/kwdb:3.1.0

RUN apt-get -o Acquire::Retries=5 update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN curl -fsSL -o /tmp/kaiwudb-jdbc.jar https://repo1.maven.org/maven2/com/kaiwudb/kaiwudb-jdbc/2.2.0/kaiwudb-jdbc-2.2.0.jar
