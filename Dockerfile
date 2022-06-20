FROM node:16.14 AS builder
RUN apt update
RUN apt install -y git
WORKDIR /usr/src
RUN git clone -b v1.2.0620 --depth 1 https://github.com/letsesign/letsesign-web-app.git
WORKDIR /usr/src/letsesign-web-app
RUN npm install
RUN npm run build --target=sender

FROM ubuntu:20.04
RUN apt update
RUN apt install -y git
RUN apt install -y curl
SHELL ["/bin/bash", "--login", "-i", "-c"]
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN source /root/.bashrc && nvm install 16.14.2
COPY --from=builder /usr/src/letsesign-web-app/build /root/build

WORKDIR /root
RUN mv ./build/index.html ./
COPY *.json ./
COPY index.js ./
COPY start.sh ./
COPY lib/ ./lib/
COPY scripts/ ./scripts/
RUN chmod +x start.sh
RUN npm install -g pm2
RUN npm install
CMD ./start.sh
