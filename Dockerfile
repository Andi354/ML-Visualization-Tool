# Stage 1: frontend
FROM node:22-slim AS web
WORKDIR /repo
COPY design/tokens.json design/tokens.json
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web web
RUN cd web && npm run build

# Stage 2: wheel (the frontend build is part of the package)
FROM python:3.12-slim AS wheel
WORKDIR /repo
RUN pip install --no-cache-dir build
COPY pyproject.toml ./
COPY src src
COPY --from=web /repo/src/mlviz/static src/mlviz/static
RUN python -m build --wheel --outdir /dist

# Stage 3: ds-store (reads the runs), built from the folder next to this repo. It is passed as the
# build context "ds-store" (docker-compose.yml does that; plain docker: --build-context ds-store=../ds-store).
FROM python:3.12-slim AS dswheel
COPY --from=ds-store . /ds-store
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /dist /ds-store

# Stage 4: runtime
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
# ds-store reads the runs (pandas and pyarrow only, not the project): installed together with the
# tool, so pip finds the dependency in the wheel built above.
COPY --from=dswheel /dist/*.whl /tmp/
COPY --from=wheel /dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl
# The project folder is mounted here; the tool writes only below it (deliverables).
ENV MLVIZ_PROJECT=/project MLVIZ_HOST=0.0.0.0 MLVIZ_PORT=8765
RUN git config --system --add safe.directory '*'
EXPOSE 8765
CMD ["mlviz", "serve"]
