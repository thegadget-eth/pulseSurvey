FROM node:16

RUN apt-get update && apt-get -y upgrade

RUN mkdir -p "/var/www/ratior"
WORKDIR "/var/www/ratior"

COPY package*.json ./
RUN npm ci --only=production

ENV CLIENT_ID=XXX
ENV GUILD_ID=XXX
ENV TOKEN=XXX
EXPOSE 32767

COPY . .
CMD ["bash", "-c", "npm run start"]
