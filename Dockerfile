FROM ubuntu:20.04
RUN apt update
RUN apt install -y curl p7zip-full
SHELL ["/bin/bash", "--login", "-i", "-c"]
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN source /root/.bashrc && nvm install 16.14.2

WORKDIR /root
COPY . .
RUN chmod +x start.sh
RUN npm install -g pm2
RUN npm install
RUN npx tsc
CMD ./start.sh
