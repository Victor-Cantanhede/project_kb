-- Banco exclusivo para os testes de integração (nunca o de desenvolvimento).
CREATE DATABASE IF NOT EXISTS hero_factory_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON hero_factory_test.* TO 'hero'@'%';
FLUSH PRIVILEGES;

