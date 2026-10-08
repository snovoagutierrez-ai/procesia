import pytest
from app import models
from tests.conftest import register_and_login, make_task


def admin_login(client, db_session):
    register_and_login(client, email='admin@example.com')
    admin = db_session.query(models.User).filter_by(email='admin@example.com').one()
    admin.role = models.UserRole.admin
    db_session.commit()


def request(client, process):
    response = client.post(f"/processes/{process['id']}/deletion-requests", json={'reason': 'Proceso duplicado'})
    assert response.status_code == 201, response.text
    return response.json()


def test_request_keeps_saved_process_and_deduplicates(auth_client, process):
    pid = process['id']
    auth_client.post(f'/processes/{pid}/snapshots', json={'snapshot_json': {}})
    first = request(auth_client, process)
    assert request(auth_client, process)['id'] == first['id']
    assert first['status'] == 'pending'
    assert auth_client.get(f'/processes/{pid}').status_code == 200
    assert len(auth_client.get(f'/processes/{pid}/snapshots').json()) == 1
    assert auth_client.delete(f'/processes/{pid}').status_code == 403
    assert len(auth_client.get('/deletion-requests').json()) == 1


def test_owner_cannot_approve_or_bypass_request_via_folder(auth_client, process):
    row = request(auth_client, process)
    assert auth_client.put(f"/deletion-requests/{row['id']}", json={'decision': 'approved'}).status_code == 403
    assert auth_client.delete(f"/processes/{process['id']}").status_code == 403
    assert auth_client.delete(f"/macroprocesses/{process['macroprocess_id']}").status_code == 403


def test_other_owner_cannot_see_or_request(client, process):
    request(client, process)
    register_and_login(client, email='other@example.com')
    assert client.get('/deletion-requests').json() == []
    assert client.post(f"/processes/{process['id']}/deletion-requests", json={'reason': 'Borrar'}).status_code == 403


@pytest.mark.parametrize('decision', ['approved', 'rejected'])
def test_admin_review_saved_process(auth_client, process, db_session, decision):
    pid = process['id']
    task = make_task(auth_client, pid, 'task-delete', 'Revisar')
    auth_client.post(f'/processes/{pid}/snapshots', json={'snapshot_json': {'tasks': [task]}})
    other = auth_client.post('/processes', json={
        'macroprocess_id': process['macroprocess_id'], 'code': 'P2', 'name': 'Otro'}).json()
    auth_client.put(f"/macroprocesses/{process['macroprocess_id']}/graph", json={'sequence_flows': [
        {'source_ref': str(pid), 'target_ref': str(other['id'])}]})
    row = request(auth_client, process)
    admin_login(auth_client, db_session)
    assert len(auth_client.get('/deletion-requests').json()) == 1
    response = auth_client.put(f"/deletion-requests/{row['id']}", json={'decision': decision, 'review_note': 'Revisado'})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated['status'] == decision
    assert updated['reviewer_email'] == 'admin@example.com'
    assert updated['review_note'] == 'Revisado'
    assert updated['reviewed_at']
    assert auth_client.put(f"/deletion-requests/{row['id']}", json={'decision': decision}).status_code == 409
    if decision == 'approved':
        assert updated['process_id'] is None
        assert db_session.query(models.Task).filter_by(id=task['id']).count() == 0
        assert db_session.query(models.ProcessSnapshot).filter_by(process_id=pid).count() == 0
        assert auth_client.get(f'/processes/{pid}').status_code == 404
        assert auth_client.get(f"/macroprocesses/{process['macroprocess_id']}/graph").json()['sequence_flows'] == []
        assert auth_client.get('/deletion-requests').json()[0]['process_name'] == process['name']
    else:
        assert updated['process_id'] == pid
        assert auth_client.get(f'/processes/{pid}').status_code == 200
        assert len(auth_client.get(f'/processes/{pid}/snapshots').json()) == 1
        assert auth_client.post('/auth/login', data={
            'username': 'qa@example.com', 'password': 'ClaveDePrueba123'}).status_code == 200
        assert request(auth_client, process)['id'] != row['id']


@pytest.mark.parametrize('target', ['processes', 'macroprocesses'])
def test_admin_direct_delete_resolves_pending(auth_client, process, db_session, target):
    row = request(auth_client, process)
    admin_login(auth_client, db_session)
    target_id = process['id'] if target == 'processes' else process['macroprocess_id']
    assert auth_client.delete(f'/{target}/{target_id}').status_code == 204
    updated = auth_client.get('/deletion-requests').json()[0]
    assert updated['id'] == row['id']
    assert updated['status'] == 'approved'
    assert updated['process_id'] is None


@pytest.mark.parametrize('reason', ['', '  ', 'a' * 1001])
def test_request_validates_reason(auth_client, process, reason):
    assert auth_client.post(f"/processes/{process['id']}/deletion-requests", json={'reason': reason}).status_code == 422


def test_approval_rolls_back_if_delete_fails(auth_client, process, db_session, monkeypatch):
    from app import crud
    from app.deletion_requests import review_deletion, DeletionReviewInput
    row = request(auth_client, process)
    admin_login(auth_client, db_session)
    user = db_session.query(models.User).filter_by(email='admin@example.com').one()
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo de borrado')
    monkeypatch.setattr(crud, 'delete_process', fail)
    with pytest.raises(RuntimeError):
        review_deletion(row['id'], DeletionReviewInput(decision='approved'), db_session, user)
    db_session.rollback()
    assert db_session.query(models.ProcessDeletionRequest).filter_by(id=row['id']).one().status == 'pending'
    assert db_session.query(models.Process).filter_by(id=process['id']).count() == 1
