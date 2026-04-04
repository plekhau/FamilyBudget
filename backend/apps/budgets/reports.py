from datetime import date, timedelta, datetime
from django.db.models import Sum
from .models import Transaction, Category


def _summary(qs):
    """Aggregate Transaction queryset by category, return list of dicts."""
    rows = list(
        qs.values("category_id")
        .annotate(total=Sum("amount"))
        .order_by("category_id")
    )
    category_ids = [row["category_id"] for row in rows]
    category_names = {
        c.id: {"name": c.name, "icon": c.icon}
        for c in Category.objects.filter(id__in=category_ids)
    }
    return [
        {
            "category_id": row["category_id"],
            "category_name": category_names.get(row["category_id"], {}).get("name", ""),
            "category_icon": category_names.get(row["category_id"], {}).get("icon", ""),
            "total": format(row["total"], ".2f"),
        }
        for row in rows
    ]


def monthly_summary(space, month_str):
    """month_str: 'YYYY-MM'"""
    dt = datetime.strptime(month_str, "%Y-%m")
    qs = Transaction.objects.filter(
        space=space,
        date__year=dt.year,
        date__month=dt.month,
    )
    return _summary(qs)


def weekly_summary(space, week_str):
    """week_str: 'YYYY-MM-DD' (start of week)"""
    start = date.fromisoformat(week_str)
    end = start + timedelta(days=6)
    qs = Transaction.objects.filter(space=space, date__range=(start, end))
    return _summary(qs)


def yearly_summary(space, year_str):
    qs = Transaction.objects.filter(space=space, date__year=int(year_str))
    return _summary(qs)
