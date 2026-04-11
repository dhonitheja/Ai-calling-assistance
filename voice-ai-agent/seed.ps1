# Frontier
Invoke-RestMethod -Uri "http://localhost:3001/api/ingest" -Method Post -ContentType "application/json" -Body '{
    "chunks": ["Teja built Digital Deflection at Frontier..."], 
    "metadata": { "source": "frontier", "role": "fullstack" }
}'

# Wipro
Invoke-RestMethod -Uri "http://localhost:3001/api/ingest" -Method Post -ContentType "application/json" -Body '{
    "chunks": ["Teja reduced API response times by 50% at Wipro..."],
    "metadata": { "source": "wipro", "role": "fullstack" }
}'

# Intellative
Invoke-RestMethod -Uri "http://localhost:3001/api/ingest" -Method Post -ContentType "application/json" -Body '{
    "chunks": ["Teja built Kafka pipelines at Intellative..."],
    "metadata": { "source": "intellative", "role": "fintech" }
}'
