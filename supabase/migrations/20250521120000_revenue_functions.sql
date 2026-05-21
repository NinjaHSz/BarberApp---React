-- Dashboard: agregação de faturamento (execute no SQL Editor do Supabase)
-- Corrige KPIs limitados aos últimos ~1000 registros do PostgREST.

CREATE OR REPLACE FUNCTION public.revenue_stats_for_date(p_date date)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day numeric;
  v_month numeric;
  v_year numeric;
  v_month_start date;
  v_month_end date;
  v_year_start date;
  v_year_end date;
BEGIN
  v_month_start := date_trunc('month', p_date)::date;
  v_month_end := (date_trunc('month', p_date) + interval '1 month' - interval '1 day')::date;
  v_year_start := date_trunc('year', p_date)::date;
  v_year_end := (date_trunc('year', p_date) + interval '1 year' - interval '1 day')::date;

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_day
  FROM agendamentos WHERE data = p_date;

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_month
  FROM agendamentos WHERE data >= v_month_start AND data <= v_month_end;

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_year
  FROM agendamentos WHERE data >= v_year_start AND data <= v_year_end;

  RETURN json_build_object('day', v_day, 'month', v_month, 'year', v_year);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_revenue_chart_series(
  p_reference_date date,
  p_granularity text
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_values numeric[] := ARRAY[]::numeric[];
  v_sum numeric;
  v_day date;
  v_week_start date;
  v_month_start date;
  v_month_end date;
  v_year_start date;
  v_hour int;
  v_hours int[] := ARRAY[8, 10, 12, 14, 16, 18, 20];
  i int;
BEGIN
  IF p_granularity = 'diario' THEN
    FOREACH v_hour IN ARRAY v_hours LOOP
      SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_sum
      FROM agendamentos
      WHERE data = p_reference_date
        AND horario IS NOT NULL
        AND (
          NULLIF(split_part(horario, ':', 1), '')::int = v_hour
          OR NULLIF(split_part(horario, ':', 1), '')::int = v_hour + 1
        );
      v_values := array_append(v_values, v_sum);
    END LOOP;

  ELSIF p_granularity = 'semanal' THEN
    v_week_start := date_trunc('week', p_reference_date::timestamp)::date;
    FOR i IN 0..5 LOOP
      v_day := v_week_start + i;
      SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_sum
      FROM agendamentos WHERE data = v_day;
      v_values := array_append(v_values, v_sum);
    END LOOP;

  ELSIF p_granularity = 'mensal' THEN
    v_month_start := date_trunc('month', p_reference_date)::date;
    v_month_end := (date_trunc('month', p_reference_date) + interval '1 month' - interval '1 day')::date;
    FOR v_day IN
      SELECT generate_series(v_month_start, v_month_end, interval '1 day')::date
    LOOP
      SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_sum
      FROM agendamentos WHERE data = v_day;
      v_values := array_append(v_values, v_sum);
    END LOOP;

  ELSIF p_granularity = 'anual' THEN
    v_year_start := date_trunc('year', p_reference_date)::date;
    FOR i IN 0..11 LOOP
      v_month_start := (v_year_start + (i || ' months')::interval)::date;
      v_month_end := (date_trunc('month', v_month_start) + interval '1 month' - interval '1 day')::date;
      SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_sum
      FROM agendamentos
      WHERE data >= v_month_start AND data <= v_month_end;
      v_values := array_append(v_values, v_sum);
    END LOOP;

  ELSE
    RAISE EXCEPTION 'granularity inválida: %', p_granularity;
  END IF;

  RETURN to_json(v_values);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revenue_stats_for_date(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_chart_series(date, text) TO anon, authenticated;
