FROM dpage/pgadmin4:8.5

USER root

ARG POSTGRES_DB
ARG POSTGRES_USER
ARG POSTGRES_PASSWORD

ENV POSTGRES_DB=${POSTGRES_DB}
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

RUN apk add --no-cache envsubst

COPY docker/pgadmin4/servers.json /tmp/servers.json
RUN envsubst </tmp/servers.json >/pgadmin4/servers.json

RUN apk del --purge envsubst

USER pgadmin
