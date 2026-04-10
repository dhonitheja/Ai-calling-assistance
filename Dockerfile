# ── Stage 1: Build React Frontend ──────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ .
# Build without API URL since Spring Boot serves both
RUN npm run build

# ── Stage 2: Build Spring Boot (with frontend bundled inside) ───
FROM maven:3.9.6-eclipse-temurin-21 AS backend-builder
WORKDIR /app
COPY backend/pom.xml .
RUN mvn dependency:go-offline -q
COPY backend/src ./src
# Embed React dist into Spring Boot static resources
COPY --from=frontend-builder /frontend/dist ./src/main/resources/static
RUN mvn package -DskipTests -q

# ── Stage 3: Minimal Runtime ────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=backend-builder /app/target/*.jar app.jar
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 8080
ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
