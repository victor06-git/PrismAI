from services.clients import UpstreamServiceError, call_cala_api


def fetch_data_insights(transcript: str) -> dict:
    """
    Query Cala using the real structured knowledge endpoint.
    """

    payload = {
        "input": transcript
    }

    data = call_cala_api(
        path="knowledge/query",
        payload=payload
    )

    if not data:
        raise UpstreamServiceError(
            "Cala API returned an empty response."
        )

    return data