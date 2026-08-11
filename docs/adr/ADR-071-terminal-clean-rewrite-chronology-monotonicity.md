# ADR-071 — Terminal temiz-yedek kronoloji monotonluğu

## Karar

Terminal çalışma defteri geçişi veya kurtarma insert'i yalnız `completed_at >= started_at` ve `updated_at = completed_at` olduğunda kabul edilir. Repository aynı kuralı SQL öncesinde de doğrular.
