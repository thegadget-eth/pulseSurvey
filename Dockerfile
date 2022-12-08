FROM node:16

RUN apt-get update && apt-get -y upgrade

RUN mkdir -p "/var/www/ratior"
WORKDIR "/var/www/ratior"

COPY package*.json ./
RUN npm ci --only=production

ENV CLIENT_ID=985553156433928232
ENV GUILD_ID=993163081939165234
ENV TOKEN=OTg1NTUzMTU2NDMzOTI4MjMy.GHaNvj.1jss28Aen1UO6QlLChSvAzTLJ3W6gOR0-R1FdA
ENV RELAUNCH_DATE=2
EXPOSE 32767

COPY . .
CMD ["bash", "-c", "npm run start"]
