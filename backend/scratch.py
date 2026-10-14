from app.database import engine
from app.models import Base, _ENUM_VALUES

def main():
    raw = engine.raw_connection()
    try:
        raw.driver_connection.autocommit = True
        cur = raw.cursor()
        for enum_name, enum_vals in _ENUM_VALUES.items():
            vals_str = ", ".join(f"'{v}'" for v in enum_vals)
            cur.execute(f"""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                        CREATE TYPE {enum_name} AS ENUM ({vals_str});
                    END IF;
                END $$;
            """)
    finally:
        raw.close()
    
    Base.metadata.create_all(engine)
    print("Tablas creadas!")

if __name__ == "__main__":
    main()
