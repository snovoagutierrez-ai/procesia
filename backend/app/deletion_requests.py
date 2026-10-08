"""Solicitudes de eliminación y decisión exclusiva de administradores."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app import auth, crud, models
from app.database import get_db

router = APIRouter()


class DeletionRequestInput(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator('reason')
    @classmethod
    def nonempty_reason(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Indica el motivo de la solicitud.')
        return value


class DeletionReviewInput(BaseModel):
    decision: Literal['approved', 'rejected']
    review_note: str = Field(default='', max_length=1000)


class DeletionRequestOutput(BaseModel):
    id: int
    process_id: int | None
    process_code: str
    process_name: str
    requester_email: str | None
    reason: str
    status: str
    reviewer_email: str | None
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None


def serialize(row):
    return DeletionRequestOutput(
        id=row.id, process_id=row.process_id, process_code=row.process_code,
        process_name=row.process_name, requester_email=row.requester.email if row.requester else None,
        reason=row.reason, status=row.status,
        reviewer_email=row.reviewer.email if row.reviewer else None,
        review_note=row.review_note, created_at=row.created_at, reviewed_at=row.reviewed_at,
    )


@router.get('/deletion-requests', response_model=list[DeletionRequestOutput])
def list_requests(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.ProcessDeletionRequest).options(
        joinedload(models.ProcessDeletionRequest.requester), joinedload(models.ProcessDeletionRequest.reviewer))
    if user.role != models.UserRole.admin:
        query = query.filter(models.ProcessDeletionRequest.requester_id == user.id)
    return [serialize(row) for row in query.order_by(models.ProcessDeletionRequest.created_at.desc(),
                                                    models.ProcessDeletionRequest.id.desc()).all()]


@router.post('/processes/{process_id}/deletion-requests', response_model=DeletionRequestOutput, status_code=201)
def request_deletion(process_id: int, data: DeletionRequestInput, db: Session = Depends(get_db),
                     user: models.User = Depends(auth.get_current_user)):
    process = db.query(models.Process).filter_by(id=process_id).with_for_update().first()
    if not process:
        raise HTTPException(404, 'Proceso no encontrado.')
    if process.owner_id != user.id and user.role != models.UserRole.admin:
        raise HTTPException(403, 'No puedes solicitar la eliminación de este proceso.')
    pending = db.query(models.ProcessDeletionRequest).filter_by(process_id=process_id, status='pending').first()
    if pending:
        return serialize(pending)
    row = models.ProcessDeletionRequest(process_id=process_id, process_code=process.code,
        process_name=process.name, requester_id=user.id, reason=data.reason, status='pending')
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Ya existe una solicitud pendiente para este proceso.')
    db.refresh(row)
    return serialize(row)


@router.put('/deletion-requests/{request_id}', response_model=DeletionRequestOutput)
def review_deletion(request_id: int, data: DeletionReviewInput, db: Session = Depends(get_db),
                    user: models.User = Depends(auth.get_current_user)):
    if user.role != models.UserRole.admin:
        raise HTTPException(403, 'Solo una cuenta administradora puede resolver solicitudes.')
    # El mismo orden de bloqueos que al solicitar/borrar: proceso, solicitud.
    row = db.query(models.ProcessDeletionRequest).filter_by(id=request_id).first()
    if not row:
        raise HTTPException(404, 'Solicitud no encontrada.')
    process_id = row.process_id
    process = db.query(models.Process).filter_by(id=process_id).with_for_update().first() if process_id else None
    db.refresh(row, with_for_update=True)
    if row.status != 'pending':
        raise HTTPException(409, 'Esta solicitud ya fue resuelta.')
    if not process:
        raise HTTPException(409, 'El proceso ya no existe.')
    row.status = data.decision
    row.reviewer_id = user.id
    row.review_note = data.review_note.strip() or None
    row.reviewed_at = datetime.now(timezone.utc)
    if data.decision == 'approved':
        db.flush()
        crud.delete_process(db, process_id, commit=False)
    db.commit()
    db.refresh(row)
    return serialize(row)
