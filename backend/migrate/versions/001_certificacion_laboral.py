"""Migración Alembic para Certificación Laboral"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_certificacion_laboral'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Enum creation is handled by models.py / database.py apply_schema typically,
    # but we can create the tables here for Alembic migration.
    op.create_table(
        'periodos_laborales',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('tipo', postgresql.ENUM('mensual', 'quincenal', 'otro', name='periodo_tipo', create_type=False), nullable=False),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_fin', sa.Date(), nullable=False),
        sa.Column('estado', postgresql.ENUM('abierto', 'en_revision', 'cerrado', name='periodo_estado', create_type=False), nullable=False),
        sa.Column('porcentaje_cumplimiento', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['contrato_id'], ['contratos.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'periodo_documentos_requeridos',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('periodo_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requisito_template_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ambito', postgresql.ENUM('empresa', 'personal', 'equipo', 'emsipor', name='req_ambito', create_type=False), nullable=False),
        sa.Column('obligatorio', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['periodo_id'], ['periodos_laborales.id'], ),
        sa.ForeignKeyConstraint(['requisito_template_id'], ['requisito_templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'periodo_documentos',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('periodo_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sujeto_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requisito_template_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('archivo_url', sa.Text(), nullable=True),
        sa.Column('estado', postgresql.ENUM('pendiente', 'cargado', 'en_revision', 'aprobado', 'observado', 'rechazado', name='periodo_doc_estado', create_type=False), nullable=False),
        sa.Column('fecha_carga', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cargado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['cargado_por'], ['users.id'], ),
        sa.ForeignKeyConstraint(['periodo_id'], ['periodos_laborales.id'], ),
        sa.ForeignKeyConstraint(['requisito_template_id'], ['requisito_templates.id'], ),
        sa.ForeignKeyConstraint(['sujeto_id'], ['sujetos.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'auditoria_documentos',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('periodo_documento_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('auditor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('accion', postgresql.ENUM('aprobar', 'observar', 'rechazar', name='auditoria_accion', create_type=False), nullable=False),
        sa.Column('observacion', sa.Text(), nullable=True),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['auditor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['periodo_documento_id'], ['periodo_documentos.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('auditoria_documentos')
    op.drop_table('periodo_documentos')
    op.drop_table('periodo_documentos_requeridos')
    op.drop_table('periodos_laborales')
