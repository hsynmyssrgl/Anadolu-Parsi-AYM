# Temiz-Yedek Terminal Kronoloji Monotonluğu V1

Build 198 ile terminal `completed_at` ve `updated_at` zamanları geçerli ISO zamanları olmalı, birbirine eşit olmalı ve `started_at` zamanından önce olamaz. Bu kural normal sonuçlandırma ve kesinti kurtarması için SQLite düzeyinde fail-closed uygulanır.
