-- Heroes module ------------------------------------------------------------
CREATE TABLE heroes (
  id               CHAR(36) CHARACTER SET ascii NOT NULL,
  name             VARCHAR(120) NOT NULL,
  nickname         VARCHAR(60)  NOT NULL,
  date_of_birth    DATE         NOT NULL,
  universe         VARCHAR(60)  NOT NULL,
  main_power       VARCHAR(60)  NOT NULL,
  avatar_url       VARCHAR(2048) NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  idempotency_key  VARCHAR(100) CHARACTER SET ascii NULL,
  idempotency_hash CHAR(64)     CHARACTER SET ascii NULL,
  created_at       DATETIME(3)  NOT NULL,
  updated_at       DATETIME(3)  NOT NULL,
  deleted_at       DATETIME(3)  NULL,
  -- 1 while the hero exists, NULL once deleted: unique keys ignore NULLs, so deleted heroes don't block new ones.
  alive            TINYINT AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_heroes_idempotency_key (idempotency_key),
  -- Same name + nickname + birth date (case and accent insensitive) = same hero. Used by create, edit and CSV import.
  UNIQUE KEY uq_heroes_identity (name, nickname, date_of_birth, alive),
  -- Newest-first keyset pagination; name/nickname are included so a search scans the index, not the table.
  KEY idx_heroes_list (deleted_at, created_at DESC, id DESC, name, nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE hero_history (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hero_id    CHAR(36) CHARACTER SET ascii NOT NULL,
  field      VARCHAR(32) NOT NULL,
  old_value  TEXT NULL,
  new_value  TEXT NULL,
  changed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_hero_history (hero_id, id),
  KEY idx_hero_history_field (hero_id, field, id),
  CONSTRAINT fk_hero_history_hero FOREIGN KEY (hero_id) REFERENCES heroes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Missions module (no FK to heroes: modules only talk through their public facade) --
CREATE TABLE missions (
  id         CHAR(36) CHARACTER SET ascii NOT NULL,
  title      VARCHAR(120) NOT NULL,
  starts_at  DATETIME(3) NOT NULL,
  ends_at    DATETIME(3) NOT NULL,
  status     ENUM('scheduled', 'in_progress', 'succeeded', 'failed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_missions_list (starts_at, id),
  KEY idx_missions_status (status, starts_at, id),
  CONSTRAINT chk_missions_period CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE mission_heroes (
  mission_id  CHAR(36) CHARACTER SET ascii NOT NULL,
  hero_id     CHAR(36) CHARACTER SET ascii NOT NULL,
  assigned_at DATETIME(3) NOT NULL,
  PRIMARY KEY (mission_id, hero_id),
  KEY idx_mission_heroes_hero (hero_id, mission_id),
  CONSTRAINT fk_mission_heroes_mission FOREIGN KEY (mission_id) REFERENCES missions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Imports module -------------------------------------------------------------
CREATE TABLE hero_imports (
  id              CHAR(36) CHARACTER SET ascii NOT NULL,
  filename        VARCHAR(255) NOT NULL,
  status          ENUM('processing', 'completed', 'failed') NOT NULL,
  total_rows      INT UNSIGNED NOT NULL,
  processed_rows  INT UNSIGNED NOT NULL DEFAULT 0,
  imported_count  INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_count     INT UNSIGNED NOT NULL DEFAULT 0,
  errors          JSON NULL,
  failure_reason  VARCHAR(255) NULL,
  created_at      DATETIME(3) NOT NULL,
  updated_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_hero_imports_created (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Avatars module -------------------------------------------------------------
CREATE TABLE avatars (
  id         CHAR(36) CHARACTER SET ascii NOT NULL,
  mime_type  VARCHAR(32) NOT NULL,
  content    MEDIUMBLOB NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

