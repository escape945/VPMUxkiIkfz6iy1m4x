FROM node:lts
WORKDIR /usr/app
COPY package*.json ./
RUN npm -g uninstall yarn
RUN corepack enable
# RUN corepack install
RUN yarn install
COPY . .
EXPOSE 3000
CMD yarn start