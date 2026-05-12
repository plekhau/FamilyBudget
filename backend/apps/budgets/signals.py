from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.spaces.models import Space

from .default_categories import DEFAULT_CATEGORIES
from .models import Category


@receiver(post_save, sender=Space)
def create_default_categories(sender, instance, created, **kwargs):
    if created:
        Category.objects.bulk_create(
            [Category(space=instance, **cat) for cat in DEFAULT_CATEGORIES]
        )
