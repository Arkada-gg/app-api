FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=3000
ENV IS_LOCAL_DEV 1

ARG APP

WORKDIR /workspace

#RUN addgroup --system core && \
#          adduser --system -G core core

ADD package.json .
ADD package-lock.json .
ADD nx.json .
ADD jest.preset.js .
ADD eslint.config.cjs .
ADD tsconfig.base.json .
ADD tsconfig.spec.json .

ADD apps/${APP}/package.json apps/${APP}/package.json
ADD apps/${APP}/eslint.config.cjs apps/${APP}/eslint.config.cjs

RUN npm run install:all

WORKDIR /workspace/apps/${APP}

ADD apps/${APP}/tsconfig.json tsconfig.json
ADD apps/${APP}/tsconfig.app.json tsconfig.app.json
ADD apps/${APP}/webpack.config.js webpack.config.js
ADD apps/${APP}/project.json project.json
ADD apps/${APP}/jest.config.ts jest.config.ts

ADD apps/${APP}/src/ src/

WORKDIR /workspace

#RUN chown -R core:core .

#USER core

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
#RUN npm --prefix core --omit=dev -f install

EXPOSE 3000/tcp

CMD [ "node", "core" ]
