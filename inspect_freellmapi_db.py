import os
import shutil
import sqlite3
import tempfile

source = "/data/freeapi.db"
temp_dir = tempfile.mkdtemp(prefix="freellmapi-inspect-")
copy_path = os.path.join(temp_dir, "freeapi.db")

try:
    print("Original exists:", os.path.exists(source))
    print("Original size:", os.path.getsize(source))

    shutil.copyfile(source, copy_path)
    print("Temporary copy size:", os.path.getsize(copy_path))

    connection = sqlite3.connect(copy_path)

    print("\n=== Integrity Check ===")
    print(connection.execute("PRAGMA quick_check").fetchone()[0])

    tables = connection.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type='table' ORDER BY name"
    ).fetchall()

    print("\n=== Tables ===")
    for (name,) in tables:
        print(name)

    print("\n=== Selected Counts ===")
    wanted = {
        "api_keys", "models", "profile_models", "profiles",
        "users", "sessions", "embedding_models",
        "media_models", "fallback_config"
    }

    for (name,) in tables:
        if name in wanted:
            count = connection.execute(
                'SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"'
            ).fetchone()[0]
            print(f"{name}: {count} rows")

    connection.close()
    print("\nInspection completed successfully.")

finally:
    shutil.rmtree(temp_dir, ignore_errors=True)
