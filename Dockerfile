FROM ubuntu:20.04
RUN apt update
RUN apt install -y curl
SHELL ["/bin/bash", "--login", "-i", "-c"]
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN source /root/.bashrc && nvm install 16.14.2

WORKDIR /root
COPY *.json ./
COPY index.js ./
COPY start.sh ./
COPY lib/ ./lib/
COPY scripts/ ./scripts/
RUN chmod +x start.sh
RUN npm install -g pm2
RUN npm install
CMD ./start.sh
